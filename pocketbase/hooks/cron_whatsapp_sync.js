cronAdd('sync_avatars', '* * * * *', () => {
  const apiUrl = $secrets.get('EVOLUTION_API_URL')
  const apiKey = $secrets.get('EVOLUTION_API_KEY')
  if (!apiUrl || !apiKey) return

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  let records = []
  try {
    records = $app.findRecordsByFilter(
      'conversations',
      `picture_fetched_at = "" || picture_fetched_at < {:cutoff}`,
      '-updated',
      20,
      0,
      { cutoff: cutoff.toISOString() },
    )
  } catch (_) {
    return
  }

  for (const record of records) {
    const instanceName = record.getString('instance_name')
    const remoteJid = record.getString('remote_jid')

    // Double check instance is connected
    try {
      const instance = $app.findFirstRecordByData(
        'whatsapp_instances',
        'instance_name',
        instanceName,
      )
      if (instance.getString('status') !== 'connected') {
        continue
      }
    } catch (_) {
      continue
    }

    try {
      const res = $http.send({
        url: `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: remoteJid }),
        timeout: 10,
      })

      if (res.statusCode === 200 && res.json && res.json.profilePictureUrl) {
        const file = $filesystem.fileFromURL(res.json.profilePictureUrl)
        record.set('avatar', file)
      }
    } catch (err) {
      $app.logger().warn('Cron failed to fetch avatar', 'jid', remoteJid, 'error', err.message)
    }

    record.set('picture_fetched_at', new Date().toISOString())

    try {
      $app.save(record)
    } catch (err) {
      $app.logger().error('Cron failed to save avatar', 'jid', remoteJid, 'error', err.message)
    }
  }
})
