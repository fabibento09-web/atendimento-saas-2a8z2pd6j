routerAdd(
  'POST',
  '/backend/v1/whatsapp/resync',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName

    if (!instanceName) {
      return e.badRequestError('instanceName is required')
    }

    const userId = e.auth && e.auth.id
    if (!userId) {
      return e.unauthorizedError('Authentication required')
    }

    let instance
    try {
      instance = $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:instanceName} && user_id = {:userId}',
        { instanceName, userId },
      )
    } catch (_) {
      return e.forbiddenError('Instance not found or not owned by user')
    }

    const evolutionUrl = $secrets.get('EVOLUTION_API_URL')
    const evolutionKey = $secrets.get('EVOLUTION_API_KEY')
    if (!evolutionUrl || !evolutionKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const baseUrl = evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl
    const processIncomingMessage = require(`${__hooks}/_lib/process_message.js`)

    setTimeout(() => {
      try {
        $app.logger().info('resync_start', 'instance', instanceName)

        const chatsRes = $http.send({
          url: `${baseUrl}/chat/findChats/${instanceName}`,
          method: 'POST',
          headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
          body: '{}',
          timeout: 30,
        })

        if (chatsRes.statusCode !== 200 || !chatsRes.json) {
          $app
            .logger()
            .error(
              'resync: failed to fetch chats',
              'instance',
              instanceName,
              'status',
              chatsRes.statusCode,
            )
          return
        }

        let chatsList = []
        const cJson = chatsRes.json
        if (Array.isArray(cJson)) chatsList = cJson
        else if (Array.isArray(cJson.records)) chatsList = cJson.records
        else if (cJson.chats && Array.isArray(cJson.chats)) chatsList = cJson.chats
        else if (cJson.chats && Array.isArray(cJson.chats.records)) chatsList = cJson.chats.records

        const validChats = chatsList
          .map((c) => ({ ...c, _jid: c.remoteJid || c.id || '' }))
          .filter((c) => c._jid && c._jid.includes('@'))

        let totalMessages = 0

        for (const chat of validChats) {
          try {
            let hasMore = true
            let page = 1

            while (hasMore && page <= 5) {
              const msgRes = $http.send({
                url: `${baseUrl}/chat/findMessages/${instanceName}`,
                method: 'POST',
                headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  where: { key: { remoteJid: chat._jid } },
                  limit: 200,
                  page: page,
                }),
                timeout: 30,
              })

              if (msgRes.statusCode !== 200 || !msgRes.json) {
                break
              }

              let messages = []
              const rJson = msgRes.json
              if (Array.isArray(rJson)) messages = rJson
              else if (Array.isArray(rJson.records)) messages = rJson.records
              else if (rJson.messages) {
                if (Array.isArray(rJson.messages.records)) messages = rJson.messages.records
                else if (Array.isArray(rJson.messages)) messages = rJson.messages
              }

              if (messages.length === 0) {
                hasMore = false
                break
              }

              for (const msg of messages) {
                try {
                  const res = processIncomingMessage(instanceName, msg)
                  if (res && res.status === 'success') totalMessages++
                } catch (_) {
                  // ignore individual msg failure
                }
              }

              if (messages.length < 200) {
                hasMore = false
              }
              page++
            }
          } catch (chatErr) {
            $app
              .logger()
              .warn('resync: chat failed', 'chat', chat._jid, 'error', chatErr.message)
          }
        }

        $app
          .logger()
          .info(
            'resync_done',
            'instance',
            instanceName,
            'chats',
            validChats.length,
            'messages_synced',
            totalMessages,
          )
      } catch (err) {
        $app.logger().error('resync_err', 'instance', instanceName, 'error', err.message)
      }
    }, 0)

    return e.json(200, { success: true, message: 'Sync started' })
  },
  $apis.requireAuth(),
)
