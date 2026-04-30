routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  const body = e.requestInfo().body || {}
  const event = body.event
  const instanceName = body.instance
  const data = body.data || {}

  if (!event || !instanceName) {
    return e.json(200, { status: 'ignored' })
  }

  const processIncomingMessage = require(`${__hooks}/_lib/process_message.js`)

  try {
    if (event === 'connection.update') {
      try {
        const record = $app.findFirstRecordByData(
          'whatsapp_instances',
          'instance_name',
          instanceName,
        )
        if (data.state === 'open') {
          const wasConnected = record.getString('status') === 'connected'
          record.set('status', 'connected')
          $app.save(record)

          // Initial Sync for Groups and Chat History
          if (!wasConnected) {
            const userId = record.getString('user_id')
            setTimeout(() => {
              try {
                const apiUrl = $secrets.get('EVOLUTION_API_URL')
                const apiKey = $secrets.get('EVOLUTION_API_KEY')
                if (!apiUrl || !apiKey) return
                const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

                // 1. Group Sync
                try {
                  const res = $http.send({
                    url: `${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
                    method: 'GET',
                    headers: { apikey: apiKey },
                    timeout: 15,
                  })
                  if (res.statusCode === 200 && res.json && Array.isArray(res.json)) {
                    for (const group of res.json) {
                      if (!group.id) continue
                      try {
                        let convRecord
                        try {
                          convRecord = $app.findFirstRecordByFilter(
                            'conversations',
                            'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
                            { userId, remoteJid: group.id, instanceName },
                          )
                        } catch (_) {
                          const convCol = $app.findCollectionByNameOrId('conversations')
                          convRecord = new Record(convCol)
                          convRecord.set('user_id', userId)
                          convRecord.set('remote_jid', group.id)
                          convRecord.set('instance_name', instanceName)
                          convRecord.set('is_group', true)
                          convRecord.set('type', 'group')
                          convRecord.set('contact_phone', group.id.split('@')[0])
                        }
                        if (group.subject) {
                          convRecord.set('contact_name', group.subject)
                        }
                        $app.save(convRecord)
                      } catch (err) {
                        $app
                          .logger()
                          .warn('Failed to upsert group during sync', 'error', err.message)
                      }
                    }
                  }
                } catch (err) {
                  $app.logger().error('Failed group sync on connect', 'error', err.message)
                }

                // 2. Chat & Message History Sync
                try {
                  const chatRes = $http.send({
                    url: `${baseUrl}/chat/findChats/${instanceName}`,
                    method: 'POST',
                    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                    body: '{}',
                    timeout: 30,
                  })

                  if (chatRes.statusCode === 200 && chatRes.json) {
                    let chats = []
                    const cJson = chatRes.json
                    if (Array.isArray(cJson)) chats = cJson
                    else if (Array.isArray(cJson.records)) chats = cJson.records
                    else if (cJson.chats && Array.isArray(cJson.chats.records))
                      chats = cJson.chats.records
                    else if (cJson.chats && Array.isArray(cJson.chats)) chats = cJson.chats

                    chats = chats
                      .map((c) => ({ ...c, _jid: c.remoteJid || c.id || '' }))
                      .filter((c) => c._jid && c._jid.includes('@'))
                    let totalMessagesSynced = 0

                    for (const chat of chats) {
                      try {
                        let hasMore = true
                        let page = 1

                        while (hasMore && page <= 5) {
                          const msgRes = $http.send({
                            url: `${baseUrl}/chat/findMessages/${instanceName}`,
                            method: 'POST',
                            headers: { apikey: apiKey, 'Content-Type': 'application/json' },
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
                            if (Array.isArray(rJson.messages)) messages = rJson.messages
                            else if (Array.isArray(rJson.messages.records))
                              messages = rJson.messages.records
                          }

                          if (!messages || messages.length === 0) {
                            hasMore = false
                            break
                          }

                          for (const msg of messages) {
                            try {
                              processIncomingMessage(instanceName, msg)
                              totalMessagesSynced++
                            } catch (err) {
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
                          .warn(
                            'Failed to sync history for chat',
                            'chat',
                            chat._jid,
                            'error',
                            chatErr.message,
                          )
                      }
                    }

                    $app
                      .logger()
                      .info(
                        'initial_sync',
                        'instance',
                        instanceName,
                        'chats',
                        chats.length,
                        'messages_synced',
                        totalMessagesSynced,
                      )
                  }
                } catch (err) {
                  $app.logger().error('Failed chat history sync', 'error', err.message)
                }
              } catch (err) {
                $app.logger().error('Background sync failed', 'error', err.message)
              }
            }, 0)
          }
        } else if (data.state === 'close') {
          record.set('status', 'disconnected')
          $app.save(record)
        }
      } catch (_) {
        $app.logger().warn('Instance not found for connection.update', 'instance', instanceName)
      }
    } else if (event === 'qrcode.updated') {
      try {
        const record = $app.findFirstRecordByData(
          'whatsapp_instances',
          'instance_name',
          instanceName,
        )
        record.set('status', 'qrcode')
        $app.save(record)
      } catch (_) {
        $app.logger().warn('Instance not found for qrcode.updated', 'instance', instanceName)
      }
    } else if (event === 'messages.upsert') {
      const result = processIncomingMessage(instanceName, data)
      return e.json(200, result)
    } else if (event === 'messages.update') {
      const updates = Array.isArray(data) ? data : [data]
      for (const item of updates) {
        try {
          const key = item.key || {}
          const messageId = key.id
          if (!messageId) continue

          const record = $app.findFirstRecordByData('whatsapp_messages', 'message_id', messageId)
          let changed = false

          const updateData = item.update || item || {}
          if (updateData.status !== undefined) {
            let statusStr = String(updateData.status)
            if (statusStr === '1') statusStr = 'pending'
            else if (statusStr === '2') statusStr = 'server_ack'
            else if (statusStr === '3') statusStr = 'delivery_ack'
            else if (statusStr === '4') statusStr = 'read'
            else if (statusStr === '5') statusStr = 'played'
            record.set('status', statusStr)
            changed = true
          }

          let editedText = ''
          const msg = updateData.message
          if (msg) {
            if (msg.editedMessage?.message?.protocolMessage?.editedMessage?.conversation) {
              editedText = msg.editedMessage.message.protocolMessage.editedMessage.conversation
            } else if (
              msg.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text
            ) {
              editedText =
                msg.editedMessage.message.protocolMessage.editedMessage.extendedTextMessage.text
            } else if (msg.conversation) {
              editedText = msg.conversation
            } else if (msg.extendedTextMessage?.text) {
              editedText = msg.extendedTextMessage.text
            }
          }

          if (editedText) {
            record.set('content', editedText)
            changed = true
          }

          if (changed) {
            $app.save(record)
          }
        } catch (_) {
          // Fail silently if record is not found
        }
      }
      return e.json(200, { status: 'processed' })
    } else if (event === 'messages.set') {
      const messages = data.messages
      if (Array.isArray(messages)) {
        $app.logger().info('Starting batch processing for messages.set', 'count', messages.length)
        const limit = 50
        const toProcess = messages.slice(0, limit)
        for (const msg of toProcess) {
          const res = processIncomingMessage(instanceName, msg)
          if (res.status === 'error') {
            $app.logger().warn('Failed to process message in batch', 'error', res.reason)
          }
        }
        if (messages.length > limit) {
          $app
            .logger()
            .info(
              'Ignored remaining messages in batch to prevent timeout',
              'ignoredCount',
              messages.length - limit,
            )
        }
      }
      return e.json(200, { status: 'received' })
    }
  } catch (err) {
    $app.logger().error('Webhook processing error', 'error', err.message)
  }

  return e.json(200, { status: 'received' })
})
