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

    const runSync = async () => {
      try {
        $app.logger().info('initial_sync_start', 'instance', instanceName)

        const chatsUrl =
          evolutionUrl.replace(/\/$/, '') + '/chat/findChats/' + encodeURIComponent(instanceName)
        const chatsRes = await fetch(chatsUrl, {
          headers: { apikey: evolutionKey },
          idleTimeout: 30,
        })

        if (!chatsRes.ok) {
          throw new Error('Failed to fetch chats: ' + chatsRes.status)
        }

        const chatsData = await chatsRes.json()
        const chatsList = Array.isArray(chatsData) ? chatsData : chatsData.records || []
        const validChats = chatsList.filter((c) => c.id && c.id.includes('@'))

        let totalMessages = 0

        for (const chat of validChats) {
          try {
            let hasMore = true
            let page = 0

            while (hasMore && page < 5) {
              const bodyReq = {
                where: { key: { remoteJid: chat.id } },
                limit: 200,
                offset: page * 200,
              }

              const msgUrl =
                evolutionUrl.replace(/\/$/, '') +
                '/chat/findMessages/' +
                encodeURIComponent(instanceName)
              const msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: {
                  apikey: evolutionKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyReq),
                idleTimeout: 30,
              })

              if (!msgRes.ok) {
                break
              }

              const msgData = await msgRes.json()
              let records = []
              if (Array.isArray(msgData)) records = msgData
              else if (msgData.records) records = msgData.records
              else if (msgData.messages && msgData.messages.records)
                records = msgData.messages.records
              else if (msgData.messages && Array.isArray(msgData.messages))
                records = msgData.messages

              if (records.length === 0) {
                break
              }

              for (const msg of records) {
                if (!msg.key || !msg.key.id) continue

                const msgId = msg.key.id
                const jid = msg.key.remoteJid || chat.id

                try {
                  $app.findFirstRecordByFilter(
                    'whatsapp_messages',
                    'instance_name = {:instanceName} && message_id = {:msgId}',
                    { instanceName, msgId },
                  )
                  continue
                } catch (err) {}

                const fromMe = msg.key.fromMe || false
                let content =
                  msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
                if (!content && msg.message?.imageMessage) content = '📷 Imagem'
                if (!content && msg.message?.videoMessage) content = '🎥 Vídeo'
                if (!content && msg.message?.documentMessage) content = '📄 Documento'
                if (!content && msg.message?.audioMessage) content = '🎵 Áudio'
                if (!content && msg.message?.stickerMessage) content = '✨ Sticker'

                const msgType = Object.keys(msg.message || {})[0] || 'conversation'
                const ts = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000)

                const newMsg = new Record($app.findCollectionByNameOrId('whatsapp_messages'))
                newMsg.set('instance_name', instanceName)
                newMsg.set('remote_jid', jid)
                newMsg.set('from_me', fromMe)
                newMsg.set('message_id', msgId)
                newMsg.set('push_name', msg.pushName || '')
                newMsg.set('content', content)
                newMsg.set('message_type', msgType)
                newMsg.set('timestamp', ts)
                newMsg.set('participant_jid', msg.key.participant || '')

                $app.save(newMsg)
                totalMessages++

                try {
                  const conv = $app.findFirstRecordByFilter(
                    'conversations',
                    'instance_name = {:instanceName} && remote_jid = {:jid}',
                    { instanceName, jid },
                  )
                  conv.set('last_message', content)
                  $app.save(conv)
                } catch (err) {
                  const newConv = new Record($app.findCollectionByNameOrId('conversations'))
                  newConv.set('instance_name', instanceName)
                  newConv.set('remote_jid', jid)
                  newConv.set('user_id', userId)
                  newConv.set('is_group', jid.includes('@g.us'))
                  newConv.set('type', jid.includes('@g.us') ? 'group' : 'individual')
                  newConv.set('contact_name', msg.pushName || jid)
                  newConv.set('last_message', content)
                  newConv.set('unread_count', 0)
                  $app.save(newConv)
                }
              }

              if (records.length < 200) {
                break
              }
              page++
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
    }

    runSync()

    return e.json(200, { success: true, message: 'Sync started' })
  },
  $apis.requireAuth(),
)
