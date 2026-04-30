cronAdd('webhook_health_check', '*/10 * * * *', () => {
  const evolutionUrl = $secrets.get('EVOLUTION_API_URL')
  const evolutionKey = $secrets.get('EVOLUTION_API_KEY')

  if (!evolutionUrl || !evolutionKey) {
    $app.logger().error('Evolution API configuration missing for webhook health check')
    return
  }

  const baseUrl = evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl
  const webhookUrl =
    $secrets.get('PB_WEBHOOK_URL') ||
    'https://atendimento-saas-be0f2.shrd00.internal.goskip.dev/backend/v1/whatsapp/webhook'

  const expectedEvents = [
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
  ].sort()

  let instances = []
  try {
    instances = $app.findRecordsByFilter('whatsapp_instances', "status = 'connected'", '', 1000, 0)
  } catch (err) {
    $app
      .logger()
      .error('Failed to retrieve connected instances for health check', 'error', err.message)
    return
  }

  for (const instance of instances) {
    const instanceName = instance.getString('instance_name')
    if (!instanceName) continue

    let needsUpdate = false

    try {
      const res = $http.send({
        url: baseUrl + '/webhook/find/' + instanceName,
        method: 'GET',
        headers: {
          apikey: evolutionKey,
        },
        timeout: 15,
      })

      if (res.statusCode !== 200) {
        needsUpdate = true
      } else {
        const data = res.json || {}
        // Handle different Evolution API response structures
        const webhookData = data.webhook || data

        // v2 has no `enabled` field — presence of URL means enabled.
        // v1 had `enabled` boolean, so accept either signal.
        const isEnabled = webhookData.enabled !== false && !!webhookData.url

        if (!isEnabled) {
          needsUpdate = true
        } else if (webhookData.url !== webhookUrl) {
          needsUpdate = true
        } else {
          const currentEvents = Array.isArray(webhookData.events)
            ? webhookData.events.slice().sort()
            : []
          if (currentEvents.join(',') !== expectedEvents.join(',')) {
            needsUpdate = true
          }
        }
      }
    } catch (err) {
      $app
        .logger()
        .error('Failed to check webhook status', 'instance', instanceName, 'error', err.message)
      continue
    }

    if (needsUpdate) {
      try {
        // We supply both root-level and nested `webhook` properties to support various Evolution API versions.
        const payload = {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: expectedEvents,
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: expectedEvents,
          },
        }

        const setRes = $http.send({
          url: baseUrl + '/webhook/set/' + instanceName,
          method: 'POST',
          headers: {
            apikey: evolutionKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          timeout: 15,
        })

        if (setRes.statusCode === 200 || setRes.statusCode === 201) {
          $app
            .logger()
            .info('Successfully restored webhook configuration', 'instance', instanceName)
        } else {
          const errorMsg = setRes.json ? setRes.json.message || JSON.stringify(setRes.json) : ''
          $app
            .logger()
            .error(
              'Failed to set webhook configuration',
              'instance',
              instanceName,
              'status',
              setRes.statusCode,
              'error',
              errorMsg,
            )
        }
      } catch (err) {
        $app
          .logger()
          .error(
            'Transport error while setting webhook configuration',
            'instance',
            instanceName,
            'error',
            err.message,
          )
      }
    }
  }
})
