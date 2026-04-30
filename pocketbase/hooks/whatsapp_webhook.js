routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  const body = e.requestInfo().body || {}
  const event = body.event
  const instanceName = body.instance
  const data = body.data || {}

  if (!event || !instanceName) {
    return e.json(200, { status: 'ignored' })
  }

  const processIncomingMessage = require(`${__hooks}/lib/process_message.js`)

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
            record.set('needs_initial_sync', true)
            $app.save(record)
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
