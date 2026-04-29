routerAdd(
  'POST',
  '/backend/v1/whatsapp/disconnect',
  (e) => {
    const body = e.requestInfo().body
    const instanceName = body.instanceName
    if (!instanceName) return e.badRequestError('Missing instanceName')

    let instanceRecord
    try {
      instanceRecord = $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:name} && user_id = {:user}',
        { name: instanceName, user: e.auth.id },
      )
    } catch (_) {
      return e.notFoundError('Instance not found')
    }

    const apiUrl = $secrets.get('EVOLUTION_API_URL')
    const apiKey = $secrets.get('EVOLUTION_API_KEY')

    if (!apiUrl || !apiKey) {
      return e.internalServerError('Evolution API configuration missing')
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

    try {
      // Logout instance in Evolution API
      $http.send({
        url: `${baseUrl}/instance/logout/${instanceName}`,
        method: 'DELETE',
        headers: { apikey: apiKey },
        timeout: 15,
      })
    } catch (err) {
      $app.logger().warn('Evolution API logout error', 'error', err.message)
    }

    // Set local status to disconnected and clear phone number
    instanceRecord.set('status', 'disconnected')
    instanceRecord.set('phone_number', '')
    $app.save(instanceRecord)

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
