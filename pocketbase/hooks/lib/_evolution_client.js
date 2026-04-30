module.exports = {
  fetchMessagesPage: function (baseUrl, apiKey, instanceName, remoteJid, limit, page) {
    return $http.send({
      url: `${baseUrl}/chat/findMessages/${instanceName}`,
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: { key: { remoteJid: remoteJid } },
        limit: limit,
        page: page,
      }),
      timeout: 30,
    })
  },
}
