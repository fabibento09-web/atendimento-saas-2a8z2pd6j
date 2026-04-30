module.exports = {
  fetchMessagesPage: (instanceName, remoteJid, page) => {
    const apiUrl = $secrets.get('EVOLUTION_API_URL')
    const apiKey = $secrets.get('EVOLUTION_API_KEY')
    if (!apiUrl || !apiKey) {
      $app.logger().error('evolution_client: API configuration missing', 'instance', instanceName)
      return { statusCode: 500, messages: [] }
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

    let msgRes
    try {
      msgRes = $http.send({
        url: `${baseUrl}/chat/findMessages/${encodeURIComponent(instanceName)}`,
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: 200,
          page: page,
        }),
        timeout: 30,
      })
    } catch (err) {
      $app
        .logger()
        .error('evolution_client: Request failed', 'instance', instanceName, 'error', err.message)
      return { statusCode: 0, messages: [] }
    }

    let messages = []
    if (msgRes.statusCode === 200 && msgRes.json) {
      const rJson = msgRes.json
      if (Array.isArray(rJson)) {
        messages = rJson
      } else if (Array.isArray(rJson.records)) {
        messages = rJson.records
      } else if (rJson.messages) {
        if (Array.isArray(rJson.messages)) {
          messages = rJson.messages
        } else if (Array.isArray(rJson.messages.records)) {
          messages = rJson.messages.records
        }
      }
    }

    return {
      statusCode: msgRes.statusCode,
      messages: messages,
    }
  },
}
