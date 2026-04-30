routerAdd(
  'POST',
  '/backend/v1/whatsapp/resync',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName

    if (!instanceName) {
      throw new BadRequestError('instanceName is required')
    }

    const userId = e.auth?.id
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const instance = $app.findFirstRecordByFilter(
      'whatsapp_instances',
      'instance_name = {:instanceName} && user_id = {:userId}',
      { instanceName, userId },
    )
    if (!instance) {
      throw new ForbiddenError('Instance not found or not owned by user')
    }

    const evolutionUrl = $secrets.get('EVOLUTION_API_URL')
    const evolutionKey = $secrets.get('EVOLUTION_API_KEY')
    if (!evolutionUrl || !evolutionKey) {
      throw new InternalServerError('Evolution API configuration missing')
    }

    const { processIncomingMessage } = require(`${__hooks}/_lib/process_message.js`)
    const { fetchMessagesPage } = require(`${__hooks}/_lib/evolution_client.js`)

    try {
      $app.logger().info('initial_sync_start', 'instance', instanceName)

      const chatsUrl =
        evolutionUrl.replace(/\/$/, '') + '/chat/findChats/' + encodeURIComponent(instanceName)

      const chatsRes = $http.send({
        url: chatsUrl,
        method: 'GET',
        headers: { apikey: evolutionKey },
        timeout: 30,
      })

      if (chatsRes.statusCode === 401 || chatsRes.statusCode === 403) {
        const failures = instance.getInt('auth_failure_count') + 1
        instance.set('auth_failure_count', failures)
        if (failures >= 3) {
          instance.set('status', 'disconnected')
          $app
            .logger()
            .warn(
              'whatsapp_resync: Instance disconnected due to auth error (3 strikes)',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        } else {
          $app
            .logger()
            .warn(
              'whatsapp_resync: Instance auth error, incrementing failure count',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        }
        $app.save(instance)
      } else if (chatsRes.statusCode === 200) {
        if (instance.getInt('auth_failure_count') > 0) {
          instance.set('auth_failure_count', 0)
          $app.save(instance)
        }
      }

      if (chatsRes.statusCode !== 200) {
        throw new Error('Failed to fetch chats: ' + chatsRes.statusCode)
      }

      const chatsData = chatsRes.json || []
      const chatsList = Array.isArray(chatsData) ? chatsData : chatsData.records || []
      const validChats = chatsList.filter((c) => c.id && c.id.includes('@'))

      let totalMessages = 0

      for (const chat of validChats) {
        try {
          for (let page = 1; page <= 5; page++) {
            const res = fetchMessagesPage(instanceName, chat.id, page)

            if (res.statusCode === 401 || res.statusCode === 403) {
              const failures = instance.getInt('auth_failure_count') + 1
              instance.set('auth_failure_count', failures)
              if (failures >= 3) {
                instance.set('status', 'disconnected')
                $app
                  .logger()
                  .warn(
                    'whatsapp_resync: Instance disconnected due to auth error on messages fetch (3 strikes)',
                    'instance',
                    instanceName,
                    'auth_failure_count',
                    failures,
                  )
              } else {
                $app
                  .logger()
                  .warn(
                    'whatsapp_resync: Instance auth error on messages fetch, incrementing failure count',
                    'instance',
                    instanceName,
                    'auth_failure_count',
                    failures,
                  )
              }
              $app.save(instance)
              break
            } else if (res.statusCode === 200) {
              if (instance.getInt('auth_failure_count') > 0) {
                instance.set('auth_failure_count', 0)
                $app.save(instance)
              }
            }

            if (res.statusCode !== 200) {
              break
            }

            const records = res.messages

            if (records.length === 0) {
              break
            }

            for (const msg of records) {
              if (!msg.key || !msg.key.id) continue

              try {
                processIncomingMessage(instanceName, msg)
                totalMessages++
              } catch (msgErr) {
                $app.logger().error('resync_msg_err', 'msgId', msg.key.id, 'error', String(msgErr))
              }
            }

            if (records.length < 200) {
              break
            }
          }
        } catch (chatErr) {
          $app.logger().error('resync_chat_err', 'chatId', chat.id, 'error', String(chatErr))
        }
      }

      $app
        .logger()
        .info(
          'initial_sync',
          'instance',
          instanceName,
          'chats',
          validChats.length,
          'messages_synced',
          totalMessages,
        )
    } catch (err) {
      $app.logger().error('resync_err', 'instance', instanceName, 'error', String(err))
    }

    return e.json(200, { success: true, message: 'Sync started' })
  },
  $apis.requireAuth(),
)
