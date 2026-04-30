routerAdd(
  'POST',
  '/backend/v1/whatsapp/resync',
  (e) => {
    const body = e.requestInfo().body || {}
    const instanceName = body.instanceName

    if (!instanceName) {
      return e.badRequestError('instanceName is required')
    }

    const userId = e.auth && e.auth.id
    if (!userId) {
      return e.unauthorizedError('Authentication required')
    }

    let instance
    try {
      instance = $app.findFirstRecordByFilter(
        'whatsapp_instances',
        'instance_name = {:instanceName} && user_id = {:userId}',
        { instanceName, userId },
      )
    } catch (_) {
      return e.forbiddenError('Instance not found or not owned by user')
    }

    instance.set('needs_resync', true)
    $app.save(instance)

    return e.json(200, { success: true, message: 'Sync scheduled' })
  },
  $apis.requireAuth(),
)
