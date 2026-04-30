routerAdd(
  'POST',
  '/backend/v1/whatsapp/send-message',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName
    const number = body.number
    const text = body.text

    if (!instanceName || !number || !text) {
      return e.badRequestError('Missing required fields: instanceName, number, text')
    }

    const userId = e.auth?.id
    if (!userId) {
      return e.unauthorizedError('Authentication required')
    }

    try {
      $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:instanceName} && user_id = {:userId}',
        { instanceName, userId },
      )
    } catch (_) {
      return e.forbiddenError('Instance not found or not owned by user')
    }

    const apiUrl = $secrets.get('EVOLUTION_API_URL') || ''
    const apiKey = $secrets.get('EVOLUTION_API_KEY') || ''

    if (!apiUrl || !apiKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const url = apiUrl.replace(/\/+$/, '') + '/message/sendText/' + instanceName

    const res = $http.send({
      url: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: number,
        text: text,
      }),
      timeout: 30,
    })

    try {
      const instance = $app.findFirstRecordByData(
        'whatsapp_instances',
        'instance_name',
        instanceName,
      )
      if (res.statusCode === 401 || res.statusCode === 403) {
        const failures = instance.getInt('auth_failure_count') + 1
        instance.set('auth_failure_count', failures)
        if (failures >= 3) {
          instance.set('status', 'disconnected')
          $app
            .logger()
            .warn(
              'whatsapp_send_message: Instance disconnected due to auth error (3 strikes)',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        } else {
          $app
            .logger()
            .warn(
              'whatsapp_send_message: Instance auth error, incrementing failure count',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        }
        $app.save(instance)
      } else if (res.statusCode === 200 || res.statusCode === 201) {
        if (instance.getInt('auth_failure_count') > 0) {
          instance.set('auth_failure_count', 0)
          $app.save(instance)
        }
      }
    } catch (_) {}

    if (res.statusCode >= 400) {
      try {
        $app
          .logger()
          .error('Evolution API sendText error', 'statusCode', res.statusCode, 'body', res.raw)
      } catch (_) {}
    } else {
      try {
        const collection = $app.findCollectionByNameOrId('whatsapp_messages')
        const record = new Record(collection)
        record.set('instance_name', instanceName)

        let jid = number
        if (!jid.includes('@')) {
          jid = jid + '@s.whatsapp.net'
        }

        record.set('remote_jid', jid)
        record.set('from_me', true)
        record.set('content', text)
        record.set('message_type', 'conversation')
        record.set('timestamp', Math.floor(Date.now() / 1000))

        if (res.json && res.json.key && res.json.key.id) {
          record.set('message_id', res.json.key.id)
        } else if (res.json && res.json.messageId) {
          record.set('message_id', res.json.messageId)
        }

        $app.saveNoValidate(record)

        // Sync Conversation
        if (jid && jid !== 'status@broadcast') {
          try {
            const isGroup = jid.includes('@g.us')
            const chatType = isGroup ? 'group' : 'individual'
            let convRecord
            try {
              convRecord = $app.findFirstRecordByFilter(
                'conversations',
                'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
                { userId, remoteJid: jid, instanceName },
              )
            } catch (_) {
              const convCol = $app.findCollectionByNameOrId('conversations')
              convRecord = new Record(convCol)
              convRecord.set('user_id', userId)
              convRecord.set('remote_jid', jid)
              convRecord.set('instance_name', instanceName)
              convRecord.set('is_group', isGroup)
              convRecord.set('type', chatType)
              convRecord.set('contact_phone', jid.split('@')[0])
            }

            convRecord.set('last_message', text)
            convRecord.set('unread_count', 0)

            const now = new Date()
            const fetchedAtStr = convRecord.getString('picture_fetched_at')
            let needsFetch = !convRecord.getString('avatar')
            if (fetchedAtStr && !needsFetch) {
              const fetchedAt = new Date(fetchedAtStr)
              if (now.getTime() - fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
                needsFetch = true
              }
            }

            if (needsFetch && apiUrl && apiKey) {
              try {
                const resAvatar = $http.send({
                  url: `${apiUrl.replace(/\/+$/, '')}/chat/fetchProfilePictureUrl/${instanceName}`,
                  method: 'POST',
                  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: jid }),
                  timeout: 10,
                })
                if (
                  resAvatar.statusCode === 200 &&
                  resAvatar.json &&
                  resAvatar.json.profilePictureUrl
                ) {
                  const file = $filesystem.fileFromURL(resAvatar.json.profilePictureUrl)
                  convRecord.set('avatar', file)
                }
              } catch (e) {
                $app
                  .logger()
                  .warn('Failed to fetch/save avatar on send message', 'error', e.message)
              }
              convRecord.set('picture_fetched_at', new Date().toISOString())
            }

            $app.save(convRecord)
          } catch (err) {
            try {
              $app
                .logger()
                .error('Failed to sync conversation on send message', 'error', err.message)
            } catch (_) {}
          }
        }
      } catch (err) {
        try {
          $app.logger().error('Failed to save sent message', 'error', err.message)
        } catch (_) {}
      }
    }

    // Retorno único e correto baseado na resposta da Evolution
    let responseData = {}
    if (res.json) {
      responseData = res.json
    }
    return e.json(res.statusCode || 200, responseData)
  },
  $apis.requireAuth(),
)
