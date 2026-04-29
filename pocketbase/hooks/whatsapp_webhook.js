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
        record.set('remote_jid', key.remoteJid || '')
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
      } catch (err) {
        $app.logger().error('Failed to save message', 'error', err.message)
      }
    }
  } catch (err) {
    $app.logger().error('Webhook processing error', 'error', err.message)
  }

  return e.json(200, { status: 'received' })
})
