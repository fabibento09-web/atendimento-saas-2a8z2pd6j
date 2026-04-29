routerAdd(
  'GET',
  '/backend/v1/whatsapp/instance-status',
  (e) => {
    const instanceName = e.request.url.query().get('instanceName')
    if (!instanceName) {
      return e.badRequestError('Missing instanceName parameter')
    }

    let instanceRecord
    try {
      instanceRecord = $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:name} && user_id = {:user}',
        { name: instanceName, user: e.auth.id },
      )
    } catch (_) {
      return e.notFoundError("Instance not found or you don't have permission to access it")
    }

    const apiUrl = $secrets.get('EVOLUTION_API_URL')
    const apiKey = $secrets.get('EVOLUTION_API_KEY')

    if (!apiUrl || !apiKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

    const res = $http.send({
      url: `${baseUrl}/instance/connect/${instanceName}`,
      method: 'GET',
      headers: { apikey: apiKey },
      timeout: 15,
    })

    if (res.statusCode !== 200) {
      let errorBody = 'Unknown error'
      try {
        if (res.json) {
          errorBody = JSON.stringify(res.json)
        } else if (res.body) {
          errorBody = new TextDecoder().decode(res.body)
        }
      } catch (_) {}

      $app
        .logger()
        .error(
          'Evolution API error fetching instance status',
          'status',
          res.statusCode,
          'body',
          errorBody,
        )
      return e.internalServerError('Error communicating with Evolution API')
    }

    const data = res.json || {}

    if (data.base64) {
      return e.json(200, {
        status: 'qrcode',
        qrcodeBase64: data.base64,
      })
    }

    if (data.instance) {
      let changed = false

      if (instanceRecord.getString('status') !== 'connected') {
        instanceRecord.set('status', 'connected')
        changed = true
      }

      const owner = data.instance.owner || data.owner || ''
      if (owner && owner.includes('@')) {
        const phone = owner.split('@')[0]
        if (instanceRecord.getString('phone_number') !== phone) {
          instanceRecord.set('phone_number', phone)
          changed = true
        }
      } else if (data.phone) {
        if (instanceRecord.getString('phone_number') !== data.phone) {
          instanceRecord.set('phone_number', data.phone)
          changed = true
        }
      }

      if (changed) {
        $app.save(instanceRecord)
      }

      return e.json(200, {
        status: 'connected',
      })
    }

    return e.json(200, {
      status: 'disconnected',
    })
  },
  $apis.requireAuth(),
)
