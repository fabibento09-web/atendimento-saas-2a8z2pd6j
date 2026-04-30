routerAdd(
  'GET',
  '/backend/v1/whatsapp/debug',
  (e) => {
    const instanceName = e.request.url.query().get('instanceName')
    if (!instanceName) {
      return e.badRequestError('Missing instanceName query parameter')
    }

    const user = e.auth
    if (!user) {
      return e.unauthorizedError('Authentication required')
    }

    let instanceRec
    try {
      instanceRec = $app.findFirstRecordByData('whatsapp_instances', 'instance_name', instanceName)
    } catch (_) {
      return e.notFoundError('Instance not found')
    }

    if (instanceRec.getString('user_id') !== user.id) {
      return e.forbiddenError('Not authorized to access this instance')
    }

    const apiUrl = $secrets.get('EVOLUTION_API_URL') || ''
    const apiKey = $secrets.get('EVOLUTION_API_KEY') || ''
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

    let webhookInfo = null
    let connectionState = null

    if (baseUrl && apiKey) {
      // Fetch Webhook Info
      try {
        const whRes = $http.send({
          url: `${baseUrl}/webhook/find/${encodeURIComponent(instanceName)}`,
          method: 'GET',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          timeout: 10,
        })
        if (whRes.statusCode >= 200 && whRes.statusCode < 300) {
          webhookInfo = whRes.json
        } else {
          webhookInfo = { error: `HTTP ${whRes.statusCode}`, data: whRes.json }
        }
      } catch (err) {
        $app
          .logger()
          .error(
            'whatsapp_debug: Failed to fetch webhook info',
            'instance',
            instanceName,
            'error',
            err.message,
          )
        webhookInfo = { error: err.message }
      }

      // Fetch Connection State
      try {
        const connRes = $http.send({
          url: `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
          method: 'GET',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          timeout: 10,
        })
        if (connRes.statusCode >= 200 && connRes.statusCode < 300) {
          connectionState = connRes.json
        } else {
          connectionState = { error: `HTTP ${connRes.statusCode}`, data: connRes.json }
        }
      } catch (err) {
        $app
          .logger()
          .error(
            'whatsapp_debug: Failed to fetch connection state',
            'instance',
            instanceName,
            'error',
            err.message,
          )
        connectionState = { error: err.message }
      }
    } else {
      const errStr = 'Evolution API configuration missing'
      webhookInfo = { error: errStr }
      connectionState = { error: errStr }
    }

    // Expected vs Actual Webhook URL
    const expectedWebhookUrl =
      ($secrets.get('PB_INSTANCE_URL') || '') + '/backend/v1/whatsapp/webhook'
    let evolutionWebhookUrl = null
    if (webhookInfo) {
      if (webhookInfo.url) evolutionWebhookUrl = webhookInfo.url
      else if (webhookInfo.webhook && webhookInfo.webhook.url)
        evolutionWebhookUrl = webhookInfo.webhook.url
    }

    const urlValidation = {
      evolutionWebhookUrl: evolutionWebhookUrl,
      expectedWebhookUrl: expectedWebhookUrl,
      match: evolutionWebhookUrl ? evolutionWebhookUrl === expectedWebhookUrl : false,
    }

    // Message counts
    const pad = (n) => n.toString().padStart(2, '0')
    const toPBDate = (d) => {
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000Z`
    }
    const p24hStr = toPBDate(new Date(Date.now() - 24 * 3600 * 1000))
    const p7dStr = toPBDate(new Date(Date.now() - 7 * 24 * 3600 * 1000))

    const stats = new DynamicModel({
      total: 0,
      count24h: 0,
      count7d: 0,
      latest: 0,
    })

    try {
      const q = `
            SELECT
                COUNT(id) as total,
                SUM(CASE WHEN created >= {:p24h} THEN 1 ELSE 0 END) as count24h,
                SUM(CASE WHEN created >= {:p7d} THEN 1 ELSE 0 END) as count7d,
                MAX(timestamp) as latest
            FROM whatsapp_messages
            WHERE instance_name = {:instance}
        `
      $app
        .db()
        .newQuery(q)
        .bind({
          instance: instanceName,
          p24h: p24hStr,
          p7d: p7dStr,
        })
        .one(stats)
    } catch (err) {
      $app
        .logger()
        .error(
          'whatsapp_debug: Failed to fetch message stats',
          'instance',
          instanceName,
          'error',
          err.message,
        )
    }

    // Fetch error logs
    let errorLogs = []
    try {
      const logs = $app.findRecordsByFilter(
        '_logs',
        'level = 8 && data.instance = {:instance}',
        '-created',
        5,
        0,
        { instance: instanceName },
      )
      errorLogs = logs.map((l) => ({
        id: l.id,
        message: l.getString('message'),
        created: l.getString('created'),
        data: l.get('data'),
      }))
    } catch (err) {
      $app.logger().warn('whatsapp_debug: Could not query _logs', 'error', err.message)
    }

    const response = {
      instance: {
        id: instanceRec.id,
        name: instanceRec.getString('instance_name'),
        status: instanceRec.getString('status'),
        phone_number: instanceRec.getString('phone_number'),
        auth_failure_count: instanceRec.getInt('auth_failure_count'),
        created: instanceRec.getString('created'),
        updated: instanceRec.getString('updated'),
      },
      evolution: {
        webhook: webhookInfo,
        connection: connectionState,
        urlValidation: urlValidation,
      },
      messages: {
        total: stats.total || 0,
        last24h: stats.count24h || 0,
        last7d: stats.count7d || 0,
        latestMessageTimestamp: stats.latest || null,
      },
      logs: errorLogs,
    }

    return e.json(200, response)
  },
  $apis.requireAuth(),
)
