routerAdd(
  'POST',
  '/backend/v1/whatsapp/send-message',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName
    const number = body.number
    const text = body.text

    if (!instanceName || !number || !text) {
      return e.badRequestError('Missing required fields: instanceName, number, text')
    }

    const userId = e.auth?.id
    if (!userId) {
      return e.unauthorizedError('Authentication required')
    }

    try {
      $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:instanceName} && user_id = {:userId}',
        { instanceName, userId },
      )
    } catch (_) {
      return e.forbiddenError('Instance not found or not owned by user')
    }

    const apiUrl = $secrets.get('EVOLUTION_API_URL') || ''
    const apiKey = $secrets.get('EVOLUTION_API_KEY') || ''

    if (!apiUrl || !apiKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const url = apiUrl.replace(/\/+$/, '') + '/message/sendText/' + instanceName

    const res = $http.send({
      url: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: number,
        text: text,
      }),
      timeout: 30,
    })

    if (res.statusCode >= 400) {
      try {
        $app
          .logger()
          .error('Evolution API sendText error', 'statusCode', res.statusCode, 'body', res.raw)
      } catch (_) {}
    }

    let responseData = {}
    if (res.json) {
      responseData = res.json
    }

    return e.json(res.statusCode || 200, responseData)
  },
  $apis.requireAuth(),
)
