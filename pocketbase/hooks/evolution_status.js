routerAdd(
  'GET',
  '/backend/v1/evolution/status',
  (e) => {
    const apiUrl = $secrets.get('EVOLUTION_API_URL')
    const apiKey = $secrets.get('EVOLUTION_API_KEY')

    if (!apiUrl || !apiKey) {
      return e.json(500, {
        configured: false,
        error: 'Evolution API secrets not configured',
        details: 'Please set EVOLUTION_API_URL and EVOLUTION_API_KEY in the instance secrets.',
        hasUrl: !!apiUrl,
        hasKey: !!apiKey,
      })
    }

    return e.json(200, {
      configured: true,
      status: 'success',
      message: 'Evolution API secrets are securely configured and accessible.',
      hasUrl: !!apiUrl,
      hasKey: !!apiKey,
    })
  },
  $apis.requireAuth(),
)
