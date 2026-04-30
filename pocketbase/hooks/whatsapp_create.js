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
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_SET',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'CONTACTS_UPSERT',
          'CONTACTS_UPDATE',
          'CHATS_UPSERT',
          'CHATS_UPDATE',
          'PRESENCE_UPDATE',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
        ],
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

    let qrcodeBase64 = ''
    let instanceId = ''
    let instanceHash = ''
    let status = 'qrcode'

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      let errorMsg = ''
      if (res.json) {
        errorMsg = res.json.message || JSON.stringify(res.json)
      }

      // If instance already exists, fallback to connecting and retrieving QR code
      if (errorMsg.includes('already exists') || res.statusCode === 403 || res.statusCode === 400) {
        try {
          const connRes = $http.send({
            url: baseUrl + '/instance/connect/' + instanceName,
            method: 'GET',
            headers: { apikey: evolutionKey },
            timeout: 30,
          })
          if (connRes.statusCode === 200) {
            qrcodeBase64 = connRes.json?.base64 || ''
          } else if (
            connRes.json &&
            connRes.json.instance &&
            connRes.json.instance.state === 'open'
          ) {
            status = 'connected'
          } else {
            $app.logger().error('Evolution API connect error', 'status', connRes.statusCode)
            return e.internalServerError('Failed to connect to existing instance')
          }
        } catch (connErr) {
          return e.internalServerError('Failed to connect to existing instance: ' + connErr.message)
        }
      } else {
        $app.logger().error('Evolution API error', 'status', res.statusCode, 'response', errorMsg)
        return e.internalServerError('Evolution API error: ' + errorMsg)
      }
    } else {
      const resData = res.json || {}
      instanceId = resData.instance ? resData.instance.instanceId || resData.instance.id || '' : ''
      if (resData.hash) {
        instanceHash = resData.hash.apikey || resData.hash
      }
      qrcodeBase64 = resData.qrcode ? resData.qrcode.base64 : ''
    }

    let record
    try {
      record = $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:name} && user_id = {:userId}',
        { name: instanceName, userId: e.auth.id },
      )
    } catch (_) {
      const collection = $app.findCollectionByNameOrId('whatsapp_instances')
      record = new Record(collection)
      record.set('user_id', e.auth.id)
      record.set('instance_name', instanceName)
      record.set('instance_id', instanceId || 'unknown')
      record.set('instance_hash', instanceHash || 'unknown')
    }

    if (instanceId) record.set('instance_id', String(instanceId))
    if (instanceHash) {
      record.set(
        'instance_hash',
        typeof instanceHash === 'string' ? instanceHash : JSON.stringify(instanceHash),
      )
    }
    record.set('status', status)

    try {
      $app.save(record)
    } catch (err) {
      $app.logger().error('Failed to save whatsapp_instance', 'error', err.message)
      return e.internalServerError('Failed to save instance record')
    }

    return e.json(200, {
      instanceName: instanceName,
      qrcodeBase64: qrcodeBase64 || '',
      status: status,
    })
  },
  $apis.requireAuth(),
)
