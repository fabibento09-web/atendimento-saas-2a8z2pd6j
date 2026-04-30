routerAdd(
  'POST',
  '/backend/v1/whatsapp/send-media',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName
    const number = body.number
    const mediatype = body.mediatype
    const caption = body.caption || ''
    const mimetype = body.mimetype || ''
    const fileName = body.fileName || 'file'
    const base64Data = body.base64

    if (!instanceName || !number || !mediatype || !base64Data) {
      return e.badRequestError('instanceName, number, mediatype, and base64 are required fields')
    }

    // Verify auth
    const instance = $app.findFirstRecordByData('whatsapp_instances', 'instance_name', instanceName)
    if (instance.get('user_id') !== e.auth.id) {
      return e.forbiddenError('Not authorized to use this instance')
    }

    const evUrl = $secrets.get('EVOLUTION_API_URL')
    const evKey = $secrets.get('EVOLUTION_API_KEY')

    let endpoint = ''
    let reqBody = {}

    if (mediatype === 'audio') {
      endpoint = `/message/sendWhatsAppAudio/${instanceName}`
      reqBody = { number: number, audio: base64Data, encoding: true }
    } else {
      endpoint = `/message/sendMedia/${instanceName}`
      reqBody = {
        number: number,
        mediatype: mediatype,
        mimetype: mimetype,
        media: base64Data,
        fileName: fileName,
        caption: caption,
      }
    }

    const url = evUrl + (evUrl.endsWith('/') ? '' : '/') + endpoint.replace(/^\//, '')

    const res = $http.send({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evKey },
      body: JSON.stringify(reqBody),
      timeout: 60,
    })

    if (res.statusCode < 200 || res.statusCode >= 300) {
      $app
        .logger()
        .error('Evolution API media error', 'status', res.statusCode, 'body', res.json || 'no json')
      return e.badRequestError('Failed to send media via Evolution API')
    }

    const col = $app.findCollectionByNameOrId('whatsapp_messages')
    const msg = new Record(col)

    const remoteJid =
      res.json.key && res.json.key.remoteJid
        ? res.json.key.remoteJid
        : number.includes('@')
          ? number
          : number + '@s.whatsapp.net'

    msg.set('instance_name', instanceName)
    msg.set('remote_jid', remoteJid)
    msg.set('from_me', true)
    msg.set('message_id', res.json.key?.id || '')
    msg.set('push_name', e.auth.getString('name') || e.auth.getString('email') || '')
    msg.set('content', caption)
    msg.set('message_type', mediatype)
    msg.set('media_type', mediatype)
    msg.set('caption', caption)
    msg.set('media_mimetype', mimetype)
    msg.set('media_filename', fileName)
    msg.set('timestamp', Math.floor(Date.now() / 1000))
    msg.set('status', 'PENDING')

    const files = e.findUploadedFiles('file')
    if (files && files.length > 0) {
      msg.set('media_file', files[0])
    }

    $app.save(msg)

    const stored = msg.getString('media_file')
    if (stored) {
      let pbUrl = $secrets.get('PB_INSTANCE_URL')
      if (pbUrl.endsWith('/')) pbUrl = pbUrl.slice(0, -1)
      msg.set('media_url', `${pbUrl}/api/files/whatsapp_messages/${msg.id}/${stored}`)
      $app.save(msg)
    }

    return e.json(200, msg)
  },
  $apis.requireAuth(),
)
