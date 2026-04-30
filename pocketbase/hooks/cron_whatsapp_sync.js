cronAdd('whatsapp_gap_fill', '*/1 * * * *', () => {
  const apiUrl = $secrets.get('EVOLUTION_API_URL')
  const apiKey = $secrets.get('EVOLUTION_API_KEY')
  if (!apiUrl || !apiKey) return

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
  $app.logger().info('whatsapp_gap_fill: Started')

  try {
    let instances = []
    try {
      instances = $app.findRecordsByFilter(
        'whatsapp_instances',
        "status = 'connected'",
        '',
        1000,
        0,
      )
    } catch (_) {}

    if (instances.length === 0) {
      $app.logger().info('whatsapp_gap_fill: No connected instances found')
      return
    }

    const processIncomingMessage = require(`${__hooks}/_lib/process_message.js`)

    for (const instance of instances) {
      const instanceName = instance.getString('instance_name')
      $app.logger().info('whatsapp_gap_fill: Instance sync started', 'instance', instanceName)
      let instanceSyncedCount = 0

      let chatsRes
      try {
        chatsRes = $http.send({
          url: `${baseUrl}/chat/findChats/${instanceName}`,
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: '{}',
          timeout: 15,
        })
      } catch (err) {
        $app
          .logger()
          .error(
            'whatsapp_gap_fill: Failed to fetch chats',
            'instance',
            instanceName,
            'error',
            err.message,
          )
        continue
      }

      if (chatsRes.statusCode === 401 || chatsRes.statusCode === 403) {
        instance.set('status', 'disconnected')
        $app.save(instance)
        $app
          .logger()
          .warn(
            'whatsapp_gap_fill: Instance disconnected due to auth error',
            'instance',
            instanceName,
          )
        continue
      }

      if (chatsRes.statusCode !== 200 || !chatsRes.json) {
        $app
          .logger()
          .warn(
            'whatsapp_gap_fill: Invalid chats response',
            'instance',
            instanceName,
            'status',
            chatsRes.statusCode,
          )
        continue
      }

      let chatsList = []
      if (Array.isArray(chatsRes.json)) chatsList = chatsRes.json
      else if (Array.isArray(chatsRes.json.records)) chatsList = chatsRes.json.records
      else if (chatsRes.json.chats && Array.isArray(chatsRes.json.chats))
        chatsList = chatsRes.json.chats
      else if (chatsRes.json.chats && Array.isArray(chatsRes.json.chats.records))
        chatsList = chatsRes.json.chats.records

      for (const chat of chatsList) {
        const remoteJid = chat.remoteJid || chat.id || ''
        if (!remoteJid || !remoteJid.includes('@')) continue

        let maxTimestamp = 0
        try {
          const latestMsg = $app.findFirstRecordByFilter(
            'whatsapp_messages',
            'instance_name = {:instanceName} && remote_jid = {:remoteJid}',
            { instanceName, remoteJid },
            '-timestamp',
          )
          maxTimestamp = latestMsg.getInt('timestamp')
        } catch (_) {}

        let page = 1
        const maxPages = 5
        let hasMore = true

        while (page <= maxPages && hasMore) {
          let msgsRes
          try {
            msgsRes = $http.send({
              url: `${baseUrl}/chat/findMessages/${instanceName}`,
              method: 'POST',
              headers: { apikey: apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                where: {
                  key: { remoteJid: remoteJid },
                },
                limit: 200,
                page: page,
              }),
              timeout: 30,
            })
          } catch (err) {
            $app
              .logger()
              .error(
                'whatsapp_gap_fill: Failed to fetch messages',
                'chat',
                remoteJid,
                'page',
                page,
                'error',
                err.message,
              )
            break
          }

          if (msgsRes.statusCode === 401 || msgsRes.statusCode === 403) {
            instance.set('status', 'disconnected')
            $app.save(instance)
            $app
              .logger()
              .warn(
                'whatsapp_gap_fill: Instance disconnected due to auth error on messages fetch',
                'instance',
                instanceName,
              )
            hasMore = false
            break
          }

          if (msgsRes.statusCode === 200 && msgsRes.json) {
            let messages = []
            if (Array.isArray(msgsRes.json)) {
              messages = msgsRes.json
            } else if (msgsRes.json.records && Array.isArray(msgsRes.json.records)) {
              messages = msgsRes.json.records
            } else if (
              msgsRes.json.messages &&
              msgsRes.json.messages.records &&
              Array.isArray(msgsRes.json.messages.records)
            ) {
              messages = msgsRes.json.messages.records
            } else if (msgsRes.json.messages && Array.isArray(msgsRes.json.messages)) {
              messages = msgsRes.json.messages
            }

            if (messages.length === 0) {
              hasMore = false
              break
            }

            let pageSyncedCount = 0
            let reachedOldMessages = false

            for (const msg of messages) {
              const msgTs = msg.messageTimestamp || 0
              if (msgTs > maxTimestamp) {
                const res = processIncomingMessage(instanceName, msg)
                if (res && res.status === 'success') {
                  pageSyncedCount++
                  instanceSyncedCount++
                }
              } else if (maxTimestamp > 0 && msgTs > 0 && msgTs <= maxTimestamp) {
                reachedOldMessages = true
              }
            }

            if (pageSyncedCount > 0) {
              $app
                .logger()
                .info(
                  'whatsapp_gap_fill: Synced messages page',
                  'chat',
                  remoteJid,
                  'page',
                  page,
                  'count',
                  pageSyncedCount,
                )
            }

            if (reachedOldMessages || messages.length < 200) {
              hasMore = false
            } else {
              page++
            }
          } else {
            hasMore = false
          }
        }

        if (instance.getString('status') === 'disconnected') {
          break
        }
      }

      $app
        .logger()
        .info(
          'whatsapp_gap_fill: Instance sync ended',
          'instance',
          instanceName,
          'totalSyncedCount',
          instanceSyncedCount,
        )
    }
  } catch (err) {
    $app.logger().error('whatsapp_gap_fill: Job failed', 'error', err.message)
  }

  $app.logger().info('whatsapp_gap_fill: Completed')
})

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
