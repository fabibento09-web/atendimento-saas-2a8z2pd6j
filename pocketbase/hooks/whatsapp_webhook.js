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
          record.set('status', 'connected')
          $app.save(record)
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
              convRecord.set('contact_phone', remoteJid.split('@')[0])
            }

            if (data.pushName && !convRecord.getString('contact_name')) {
              convRecord.set('contact_name', data.pushName)
            }
            convRecord.set('last_message', content)

            // Try to fetch avatar if missing
            if (!convRecord.getString('avatar_url')) {
              const apiUrl = $secrets.get('EVOLUTION_API_URL')
              const apiKey = $secrets.get('EVOLUTION_API_KEY')
              if (apiUrl && apiKey) {
                try {
                  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
                  const res = $http.send({
                    url: `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
                    method: 'POST',
                    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: remoteJid }),
                    timeout: 5,
                  })
                  if (res.statusCode === 200 && res.json && res.json.profilePictureUrl) {
                    convRecord.set('avatar_url', res.json.profilePictureUrl)
                  } else {
                    convRecord.set('avatar_url', 'none')
                  }
                } catch (e) {
                  $app.logger().warn('Failed to fetch avatar', 'error', e.message)
                  convRecord.set('avatar_url', 'none') // prevent retries on error
                }
              } else {
                convRecord.set('avatar_url', 'none')
              }
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
