routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  const body = e.requestInfo().body || {}
  const event = body.event
  const instanceName = body.instance
  const data = body.data || {}

  if (!event || !instanceName) {
    return e.json(200, { status: 'ignored' })
  }

  const processIncomingMessage = require(`${__dirname}/_lib/process_message.js`)

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
      const result = processIncomingMessage(instanceName, data)
      return e.json(200, result)
    } else if (event === 'messages.set') {
      const messages = data.messages
      if (Array.isArray(messages)) {
        $app.logger().info('Starting batch processing for messages.set', 'count', messages.length)
        for (const msg of messages) {
          const res = processIncomingMessage(instanceName, msg)
          if (res.status === 'error') {
            $app.logger().warn('Failed to process message in batch', 'error', res.reason)
          }
        }
      }
      return e.json(200, { status: 'received' })
    }
  } catch (err) {
    $app.logger().error('Webhook processing error', 'error', err.message)
  }

  return e.json(200, { status: 'received' })
})
