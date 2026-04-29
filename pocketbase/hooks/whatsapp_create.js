routerAdd(
  'POST',
  '/backend/v1/whatsapp/create-instance',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName

    if (!instanceName) {
      return e.badRequestError('instanceName is required')
    }

    const evolutionUrl = $secrets.get('EVOLUTION_API_URL')
    const evolutionKey = $secrets.get('EVOLUTION_API_KEY')

    if (!evolutionUrl || !evolutionKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const baseUrl = evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl
    const webhookUrl =
      'https://atendimento-saas-be0f2.shrd00.internal.goskip.dev/backend/v1/whatsapp/webhook'

    const payload = {
      instanceName: instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: true,
      alwaysOnline: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      },
    }

    let res
    try {
      res = $http.send({
        url: baseUrl + '/instance/create',
        method: 'POST',
        headers: {
          apikey: evolutionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: 30,
      })
    } catch (err) {
      $app.logger().error('Evolution API transport error', 'error', err.message)
      return e.internalServerError('Evolution API transport error: ' + err.message)
    }

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      let errorMsg = 'Evolution API returned an error'
      if (res.json) {
        errorMsg = res.json.message || JSON.stringify(res.json)
      }
      $app.logger().error('Evolution API error', 'status', res.statusCode, 'response', errorMsg)
      return e.internalServerError('Evolution API error: ' + errorMsg)
    }

    const resData = res.json || {}
    const instanceId = resData.instance
      ? resData.instance.instanceId || resData.instance.id || ''
      : ''
    let instanceHash = ''
    if (resData.hash) {
      instanceHash = resData.hash.apikey || resData.hash
    }
    const qrcodeBase64 = resData.qrcode ? resData.qrcode.base64 : ''

    const collection = $app.findCollectionByNameOrId('whatsapp_instances')
    const record = new Record(collection)

    record.set('user_id', e.auth.id)
    record.set('instance_name', instanceName)
    record.set('instance_id', String(instanceId))
    record.set(
      'instance_hash',
      typeof instanceHash === 'string' ? instanceHash : JSON.stringify(instanceHash),
    )
    record.set('status', 'qrcode')

    try {
      $app.save(record)
    } catch (err) {
      $app.logger().error('Failed to save whatsapp_instance', 'error', err.message)
      return e.internalServerError('Failed to save instance record')
    }

    return e.json(200, {
      instanceName: instanceName,
      qrcodeBase64: qrcodeBase64 || '',
      status: 'qrcode',
    })
  },
  $apis.requireAuth(),
)
