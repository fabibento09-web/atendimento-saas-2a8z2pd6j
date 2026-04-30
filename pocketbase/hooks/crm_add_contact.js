routerAdd(
  'POST',
  '/backend/v1/crm/add-contact',
  (e) => {
    const body = e.requestInfo().body
    const instanceName = body.instance_name
    const jid = body.jid
    if (!instanceName || !jid) return e.badRequestError('instance_name and jid are required')

    const userId = e.auth.id

    try {
      $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'user_id={:userId} && instance_name={:instanceName}',
        { userId, instanceName },
      )
    } catch (_) {
      return e.forbiddenError('Instance not found or not owned by user')
    }

    const evoUrl = $secrets.get('EVOLUTION_API_URL')
    const evoKey = $secrets.get('EVOLUTION_API_KEY')

    const number = jid.replace('@s.whatsapp.net', '')

    let picUrl = ''

    if (evoUrl && evoKey) {
      const baseUrl = evoUrl.endsWith('/') ? evoUrl.slice(0, -1) : evoUrl
      try {
        const picRes = $http.send({
          url: `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
          method: 'POST',
          headers: { apikey: evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number }),
          timeout: 10,
        })
        if (picRes.statusCode === 200 && picRes.json && picRes.json.profilePictureUrl) {
          picUrl = picRes.json.profilePictureUrl
        }
      } catch (err) {}
    }

    let record
    let isNew = false
    try {
      record = $app.findFirstRecordByFilter(
        'crm_contacts',
        'user_id={:userId} && instance_name={:instanceName} && jid={:jid}',
        { userId, instanceName, jid },
      )
    } catch (_) {
      const col = $app.findCollectionByNameOrId('crm_contacts')
      record = new Record(col)
      record.set('user_id', userId)
      record.set('instance_name', instanceName)
      record.set('jid', jid)
      record.set('phone', number)
      record.set('stage', 'lead')
      isNew = true
    }

    try {
      const conv = $app.findFirstRecordByFilter(
        'conversations',
        'instance_name={:instanceName} && remote_jid={:jid}',
        { instanceName, jid },
      )
      if (conv.getString('contact_name')) {
        record.set('push_name', conv.getString('contact_name'))
      }
    } catch (_) {}

    record.set('last_synced_at', new Date().toISOString())

    if (picUrl) {
      record.set('avatar_url', picUrl)
      try {
        const file = $filesystem.fileFromURL(picUrl, 10)
        record.set('avatar_file', file)
      } catch (_) {}
    }

    $app.save(record)

    return e.json(200, record)
  },
  $apis.requireAuth(),
)
