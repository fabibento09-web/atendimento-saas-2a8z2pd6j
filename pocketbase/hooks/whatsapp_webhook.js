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
        const key = data.key || {}
        const messageId = key.id || ''

        if (messageId) {
          try {
            $app.findFirstRecordByData('whatsapp_messages', 'message_id', messageId)
            return e.json(200, { status: 'ignored', reason: 'duplicate' })
          } catch (_) {}
        }

        const col = $app.findCollectionByNameOrId('whatsapp_messages')
        const record = new Record(col)

        record.set('instance_name', instanceName)
        const remoteJid = key.remoteJid || ''
        record.set('remote_jid', remoteJid)
        record.set('from_me', !!key.fromMe)
        record.set('message_id', messageId)
        record.set('push_name', data.pushName || '')
        record.set('timestamp', data.messageTimestamp || 0)

        const messageData = data.message || {}
        let messageType = data.messageType || 'text'
        let content = ''
        let mediaMimetype = ''
        let mediaFilename = ''
        let caption = ''

        if (messageData.conversation) {
          content = messageData.conversation
        } else if (messageData.extendedTextMessage && messageData.extendedTextMessage.text) {
          content = messageData.extendedTextMessage.text
        } else if (messageData.imageMessage) {
          messageType = 'image'
          mediaMimetype = messageData.imageMessage.mimetype
          caption = messageData.imageMessage.caption || ''
        } else if (messageData.videoMessage) {
          messageType = 'video'
          mediaMimetype = messageData.videoMessage.mimetype
          caption = messageData.videoMessage.caption || ''
        } else if (messageData.audioMessage) {
          messageType = 'audio'
          mediaMimetype = messageData.audioMessage.mimetype
        } else if (messageData.documentMessage) {
          messageType = 'document'
          mediaMimetype = messageData.documentMessage.mimetype
          mediaFilename =
            messageData.documentMessage.fileName || messageData.documentMessage.title || ''
          caption = messageData.documentMessage.caption || ''
        } else if (messageData.stickerMessage) {
          messageType = 'sticker'
          mediaMimetype = messageData.stickerMessage.mimetype
        } else {
          content = JSON.stringify(messageData)
        }

        const finalContent = content || caption || ''
        record.set('message_type', messageType)
        record.set('content', finalContent)
        record.set('caption', caption)
        record.set('media_mimetype', mediaMimetype || '')
        record.set('media_filename', mediaFilename || '')

        if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
          const apiUrl = $secrets.get('EVOLUTION_API_URL')
          const apiKey = $secrets.get('EVOLUTION_API_KEY')
          const baseUrl = apiUrl && apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

          if (baseUrl && apiKey) {
            try {
              const res = $http.send({
                url: `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
                method: 'POST',
                headers: {
                  apikey: apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: { key: key }, convertToMp4: false }),
                timeout: 30,
              })

              if (res.statusCode === 200 && res.json && res.json.base64) {
                const b64 = res.json.base64
                  .split(',')
                  .pop()
                  .replace(/[^A-Za-z0-9\+\/]/g, '')
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
                const lookup = {}
                for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i

                const bytes = new Uint8Array(b64.length * 0.75)
                let p = 0
                for (let i = 0; i < b64.length; i += 4) {
                  const c1 = lookup[b64.charCodeAt(i)]
                  const c2 = lookup[b64.charCodeAt(i + 1)]
                  const c3 = lookup[b64.charCodeAt(i + 2)]
                  const c4 = lookup[b64.charCodeAt(i + 3)]
                  if (c1 !== undefined && c2 !== undefined) {
                    bytes[p++] = (c1 << 2) | (c2 >> 4)
                    if (c3 !== undefined) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2)
                    if (c4 !== undefined) bytes[p++] = ((c3 & 3) << 6) | (c4 & 63)
                  }
                }
                const actualBytes = bytes.slice(0, p)

                const ext = (mediaMimetype || '').split('/')[1]?.split(';')[0] || 'bin'
                const finalFilename = mediaFilename || `${$security.randomString(8)}.${ext}`
                record.set('media_filename', finalFilename)

                const file = $filesystem.fileFromBytes(actualBytes, finalFilename)
                record.set('media_file', file)
              } else {
                $app
                  .logger()
                  .error(
                    'Failed to get base64 media',
                    'status',
                    res.statusCode,
                    'body',
                    res.raw || res.json,
                  )
              }
            } catch (err) {
              $app.logger().error('Error fetching base64 media', 'error', err.message)
            }
          }
        }

        $app.save(record)

        if (record.getString('media_file')) {
          const pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
          if (pbUrl) {
            const fileUrl = `${pbUrl.endsWith('/') ? pbUrl.slice(0, -1) : pbUrl}/api/files/${record.collectionId}/${record.id}/${record.getString('media_file')}`
            record.set('media_url', fileUrl)
            $app.saveNoValidate(record)
          }
        }

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
            convRecord.set(
              'last_message',
              finalContent || (messageType !== 'text' ? `[${messageType}]` : ''),
            )

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
