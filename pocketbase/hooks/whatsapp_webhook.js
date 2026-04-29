routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  const body = e.requestInfo().body || {}
  const event = body.event
  const instanceName = body.instance
  const data = body.data || {}

  if (!event || !instanceName) {
    return e.json(200, { status: 'ignored' })
  }

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

          // Initial Sync for Groups
          if (!wasConnected) {
            try {
              const apiUrl = $secrets.get('EVOLUTION_API_URL')
              const apiKey = $secrets.get('EVOLUTION_API_KEY')
              if (apiUrl && apiKey) {
                const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
                const res = $http.send({
                  url: `${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
                  method: 'GET',
                  headers: { apikey: apiKey },
                  timeout: 15,
                })
                if (res.statusCode === 200 && res.json && Array.isArray(res.json)) {
                  const userId = record.getString('user_id')
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
                      $app.logger().warn('Failed to upsert group during sync', 'error', err.message)
                    }
                  }
                }
              }
            } catch (err) {
              $app.logger().error('Failed group sync on connect', 'error', err.message)
            }
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
      try {
        const col = $app.findCollectionByNameOrId('whatsapp_messages')
        const record = new Record(col)

        record.set('instance_name', instanceName)

        const key = data.key || {}
        const remoteJid = key.remoteJid || ''
        record.set('remote_jid', remoteJid)
        record.set('from_me', !!key.fromMe)
        record.set('message_id', key.id || '')

        record.set('push_name', data.pushName || '')

        let content = ''
        if (data.message) {
          if (data.message.conversation) {
            content = data.message.conversation
          } else if (data.message.extendedTextMessage && data.message.extendedTextMessage.text) {
            content = data.message.extendedTextMessage.text
          } else if (data.message.imageMessage && data.message.imageMessage.caption) {
            content = data.message.imageMessage.caption
          } else {
            content = JSON.stringify(data.message)
          }
        }
        record.set('content', content)

        record.set('message_type', data.messageType || '')
        record.set('timestamp', data.messageTimestamp || 0)

        $app.save(record)

        // Sync Conversation
        if (remoteJid && remoteJid !== 'status@broadcast') {
          let instanceRecord
          try {
            instanceRecord = $app.findFirstRecordByData(
              'whatsapp_instances',
              'instance_name',
              instanceName,
            )
          } catch (_) {}

          if (instanceRecord) {
            const userId = instanceRecord.getString('user_id')
            const isGroup = remoteJid.includes('@g.us') || !!data.isGroup
            const chatType = isGroup ? 'group' : 'individual'

            let convRecord
            try {
              convRecord = $app.findFirstRecordByFilter(
                'conversations',
                'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
                { userId, remoteJid, instanceName },
              )
            } catch (_) {
              const convCol = $app.findCollectionByNameOrId('conversations')
              convRecord = new Record(convCol)
              convRecord.set('user_id', userId)
              convRecord.set('remote_jid', remoteJid)
              convRecord.set('instance_name', instanceName)
              convRecord.set('is_group', isGroup)
              convRecord.set('type', chatType)
              convRecord.set('contact_phone', remoteJid.split('@')[0])
            }

            if (chatType === 'individual' && data.pushName) {
              convRecord.set('contact_name', data.pushName)
            }
            convRecord.set('last_message', content)

            if (!key.fromMe) {
              const currentUnread = convRecord.getInt('unread_count') || 0
              convRecord.set('unread_count', currentUnread + 1)
            } else {
              convRecord.set('unread_count', 0)
            }

            const apiUrl = $secrets.get('EVOLUTION_API_URL')
            const apiKey = $secrets.get('EVOLUTION_API_KEY')
            const baseUrl = apiUrl && apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

            // Retrieve group name if missing
            if (
              chatType === 'group' &&
              !convRecord.getString('contact_name') &&
              baseUrl &&
              apiKey
            ) {
              try {
                const res = $http.send({
                  url: `${baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${remoteJid}`,
                  method: 'GET',
                  headers: { apikey: apiKey },
                  timeout: 5,
                })
                if (res.statusCode === 200 && res.json && res.json.subject) {
                  convRecord.set('contact_name', res.json.subject)
                }
              } catch (e) {
                $app.logger().warn('Failed to fetch group info', 'error', e.message)
              }
            }

            const now = new Date()
            const fetchedAtStr = convRecord.getString('picture_fetched_at')
            let needsFetch = !convRecord.getString('avatar')
            if (fetchedAtStr && !needsFetch) {
              const fetchedAt = new Date(fetchedAtStr)
              if (now.getTime() - fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
                needsFetch = true
              }
            }

            if (needsFetch && baseUrl && apiKey) {
              try {
                const res = $http.send({
                  url: `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
                  method: 'POST',
                  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: remoteJid }),
                  timeout: 10,
                })
                if (res.statusCode === 200 && res.json && res.json.profilePictureUrl) {
                  const file = $filesystem.fileFromURL(res.json.profilePictureUrl)
                  convRecord.set('avatar', file)
                }
              } catch (e) {
                $app.logger().warn('Failed to fetch/save avatar', 'error', e.message)
              }
              // Update fetch time regardless of success to avoid endless retry loops
              convRecord.set('picture_fetched_at', new Date().toISOString())
            }

            $app.save(convRecord)
          }
        }
      } catch (err) {
        $app.logger().error('Failed to save message or sync conversation', 'error', err.message)
      }
    }
  } catch (err) {
    $app.logger().error('Webhook processing error', 'error', err.message)
  }

  return e.json(200, { status: 'received' })
})
