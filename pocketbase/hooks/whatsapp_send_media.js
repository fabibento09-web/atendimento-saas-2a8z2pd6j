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

    if (res.statusCode === 401 || res.statusCode === 403) {
      const failures = instance.getInt('auth_failure_count') + 1
      instance.set('auth_failure_count', failures)
      if (failures >= 3) {
        instance.set('status', 'disconnected')
        $app
          .logger()
          .warn(
            'whatsapp_send_media: Instance disconnected due to auth error (3 strikes)',
            'instance',
            instanceName,
            'auth_failure_count',
            failures,
          )
      } else {
        $app
          .logger()
          .warn(
            'whatsapp_send_media: Instance auth error, incrementing failure count',
            'instance',
            instanceName,
            'auth_failure_count',
            failures,
          )
      }
      $app.save(instance)
    } else if (res.statusCode === 200 || res.statusCode === 201) {
      if (instance.getInt('auth_failure_count') > 0) {
        instance.set('auth_failure_count', 0)
        $app.save(instance)
      }
    }

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

    // Sync Conversation
    if (remoteJid && remoteJid !== 'status@broadcast') {
      try {
        const isGroup = remoteJid.includes('@g.us')
        const chatType = isGroup ? 'group' : 'individual'
        const userId = e.auth.id
        let convRecord
        try {
          convRecord = $app.findFirstRecordByFilter(
            'conversations',
            'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
            { userId, remoteJid: remoteJid, instanceName },
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

        convRecord.set('last_message', caption || `[${mediatype}]`)
        convRecord.set('unread_count', 0)

        const now = new Date()
        const fetchedAtStr = convRecord.getString('picture_fetched_at')
        let needsFetch = !convRecord.getString('avatar')
        if (fetchedAtStr && !needsFetch) {
          const fetchedAt = new Date(fetchedAtStr)
          if (now.getTime() - fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
            needsFetch = true
          }
        }

        if (needsFetch && evUrl && evKey) {
          try {
            const resAvatar = $http.send({
              url: `${evUrl.replace(/\/+$/, '')}/chat/fetchProfilePictureUrl/${instanceName}`,
              method: 'POST',
              headers: { apikey: evKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: remoteJid }),
              timeout: 10,
            })
            if (
              resAvatar.statusCode === 200 &&
              resAvatar.json &&
              resAvatar.json.profilePictureUrl
            ) {
              const file = $filesystem.fileFromURL(resAvatar.json.profilePictureUrl)
              convRecord.set('avatar', file)
            }
          } catch (err) {
            $app.logger().warn('Failed to fetch/save avatar on send media', 'error', err.message)
          }
          convRecord.set('picture_fetched_at', new Date().toISOString())
        }

        $app.save(convRecord)
      } catch (err) {
        $app.logger().error('Failed to sync conversation on send media', 'error', err.message)
      }
    }

    return e.json(200, msg)
  },
  $apis.requireAuth(),
)
