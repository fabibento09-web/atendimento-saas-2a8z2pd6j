cronAdd('whatsapp_initial_sync', '*/30 * * * * *', () => {
  const apiUrl = $secrets.get('EVOLUTION_API_URL')
  const apiKey = $secrets.get('EVOLUTION_API_KEY')
  if (!apiUrl || !apiKey) return

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

  let instances = []
  try {
    instances = $app.findRecordsByFilter(
      'whatsapp_instances',
      'needs_initial_sync = true',
      '',
      10,
      0,
    )
  } catch (_) {}

  if (instances.length === 0) return

  const processIncomingMessage = require(`${__hooks}/_lib/process_message.js`)

  for (const instance of instances) {
    const instanceName = instance.getString('instance_name')
    const userId = instance.getString('user_id')
    $app.logger().info('whatsapp_initial_sync: Started for instance', 'instance', instanceName)

    try {
      // 1. Group Sync
      try {
        const res = $http.send({
          url: `${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
          method: 'GET',
          headers: { apikey: apiKey },
          timeout: 15,
        })
        if (res.statusCode === 401 || res.statusCode === 403) {
          const failures = instance.getInt('auth_failure_count') + 1
          instance.set('auth_failure_count', failures)
          if (failures >= 3) {
            instance.set('status', 'disconnected')
            $app
              .logger()
              .warn(
                'whatsapp_initial_sync: Instance disconnected due to auth error (3 strikes)',
                'instance',
                instanceName,
                'auth_failure_count',
                failures,
              )
          } else {
            $app
              .logger()
              .warn(
                'whatsapp_initial_sync: Instance auth error, incrementing failure count',
                'instance',
                instanceName,
                'auth_failure_count',
                failures,
              )
          }
          $app.save(instance)
        } else if (res.statusCode === 200) {
          if (instance.getInt('auth_failure_count') > 0) {
            instance.set('auth_failure_count', 0)
            $app.save(instance)
          }
        }
        if (res.statusCode === 200 && res.json && Array.isArray(res.json)) {
          for (const group of res.json) {
            if (!group.id) continue
            try {
              let convRecord
              try {
                convRecord = $app.findFirstRecordByFilter(
                  'conversations',
                  'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
                  { userId, remoteJid: group.id, instanceName },
                )
              } catch (_) {
                const convCol = $app.findCollectionByNameOrId('conversations')
                convRecord = new Record(convCol)
                convRecord.set('user_id', userId)
                convRecord.set('remote_jid', group.id)
                convRecord.set('instance_name', instanceName)
                convRecord.set('is_group', true)
                convRecord.set('type', 'group')
                convRecord.set('contact_phone', group.id.split('@')[0])
              }
              if (group.subject) {
                convRecord.set('contact_name', group.subject)
              }
              $app.save(convRecord)
            } catch (err) {
              $app.logger().warn('Failed to upsert group during initial sync', 'error', err.message)
            }
          }
        }
      } catch (err) {
        $app.logger().error('Failed group initial sync', 'error', err.message)
      }

      // 2. Chat & Message History Sync
      try {
        const chatRes = $http.send({
          url: `${baseUrl}/chat/findChats/${instanceName}`,
          method: 'GET',
          headers: { apikey: apiKey },
          timeout: 30,
        })

        if (chatRes.statusCode === 401 || chatRes.statusCode === 403) {
          const failures = instance.getInt('auth_failure_count') + 1
          instance.set('auth_failure_count', failures)
          if (failures >= 3) {
            instance.set('status', 'disconnected')
            $app
              .logger()
              .warn(
                'whatsapp_initial_sync: Instance disconnected due to auth error on chats fetch (3 strikes)',
                'instance',
                instanceName,
                'auth_failure_count',
                failures,
              )
          } else {
            $app
              .logger()
              .warn(
                'whatsapp_initial_sync: Instance auth error on chats fetch, incrementing failure count',
                'instance',
                instanceName,
                'auth_failure_count',
                failures,
              )
          }
          $app.save(instance)
        } else if (chatRes.statusCode === 200) {
          if (instance.getInt('auth_failure_count') > 0) {
            instance.set('auth_failure_count', 0)
            $app.save(instance)
          }
        }

        if (chatRes.statusCode === 200 && chatRes.json) {
          let chats = []
          const cJson = chatRes.json
          if (Array.isArray(cJson)) chats = cJson
          else if (Array.isArray(cJson.records)) chats = cJson.records
          else if (cJson.chats && Array.isArray(cJson.chats.records)) chats = cJson.chats.records
          else if (cJson.chats && Array.isArray(cJson.chats)) chats = cJson.chats

          chats = chats.filter((c) => c.id && c.id.includes('@'))
          let totalMessagesSynced = 0

          for (const chat of chats) {
            try {
              let hasMore = true
              let page = 1

              while (hasMore && page <= 5) {
                const msgRes = $http.send({
                  url: `${baseUrl}/chat/findMessages/${instanceName}`,
                  method: 'POST',
                  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    where: { key: { remoteJid: chat.id } },
                    limit: 200,
                    page: page,
                    offset: (page - 1) * 200,
                  }),
                  timeout: 30,
                })

                if (msgRes.statusCode === 401 || msgRes.statusCode === 403) {
                  const failures = instance.getInt('auth_failure_count') + 1
                  instance.set('auth_failure_count', failures)
                  if (failures >= 3) {
                    instance.set('status', 'disconnected')
                    $app
                      .logger()
                      .warn(
                        'whatsapp_initial_sync: Instance disconnected due to auth error on messages fetch (3 strikes)',
                        'instance',
                        instanceName,
                        'auth_failure_count',
                        failures,
                      )
                  } else {
                    $app
                      .logger()
                      .warn(
                        'whatsapp_initial_sync: Instance auth error on messages fetch, incrementing failure count',
                        'instance',
                        instanceName,
                        'auth_failure_count',
                        failures,
                      )
                  }
                  $app.save(instance)
                  break
                } else if (msgRes.statusCode === 200) {
                  if (instance.getInt('auth_failure_count') > 0) {
                    instance.set('auth_failure_count', 0)
                    $app.save(instance)
                  }
                }

                if (msgRes.statusCode !== 200 || !msgRes.json) {
                  break
                }

                let messages = []
                const rJson = msgRes.json
                if (Array.isArray(rJson)) messages = rJson
                else if (Array.isArray(rJson.records)) messages = rJson.records
                else if (rJson.messages) {
                  if (Array.isArray(rJson.messages)) messages = rJson.messages
                  else if (Array.isArray(rJson.messages.records)) messages = rJson.messages.records
                }

                if (!messages || messages.length === 0) {
                  hasMore = false
                  break
                }

                for (const msg of messages) {
                  try {
                    processIncomingMessage(instanceName, msg)
                    totalMessagesSynced++
                  } catch (err) {}
                }

                if (messages.length < 200) {
                  hasMore = false
                }
                page++
              }
            } catch (chatErr) {
              $app
                .logger()
                .warn('Failed to sync history for chat', 'chat', chat.id, 'error', chatErr.message)
            }
          }

          $app
            .logger()
            .info(
              'whatsapp_initial_sync: Completed for instance',
              'instance',
              instanceName,
              'chats',
              chats.length,
              'messages_synced',
              totalMessagesSynced,
            )
        }
      } catch (err) {
        $app.logger().error('Failed chat history initial sync', 'error', err.message)
      }

      // Mark as synced
      instance.set('needs_initial_sync', false)
      $app.save(instance)
    } catch (err) {
      $app
        .logger()
        .error(
          'whatsapp_initial_sync failed for instance',
          'instance',
          instanceName,
          'error',
          err.message,
        )
    }
  }
})

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
          method: 'GET',
          headers: { apikey: apiKey },
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
        const failures = instance.getInt('auth_failure_count') + 1
        instance.set('auth_failure_count', failures)
        if (failures >= 3) {
          instance.set('status', 'disconnected')
          $app
            .logger()
            .warn(
              'whatsapp_gap_fill: Instance disconnected due to auth error (3 strikes)',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        } else {
          $app
            .logger()
            .warn(
              'whatsapp_gap_fill: Instance auth error, incrementing failure count',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        }
        $app.save(instance)
        continue
      } else if (chatsRes.statusCode === 200) {
        if (instance.getInt('auth_failure_count') > 0) {
          instance.set('auth_failure_count', 0)
          $app.save(instance)
        }
      }

      if (chatsRes.statusCode !== 200 || !Array.isArray(chatsRes.json)) {
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

      for (const chat of chatsRes.json) {
        if (!chat.id || (!chat.id.includes('@') && !chat.id.endsWith('@lid'))) continue
        const remoteJid = chat.id

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
            const failures = instance.getInt('auth_failure_count') + 1
            instance.set('auth_failure_count', failures)
            if (failures >= 3) {
              instance.set('status', 'disconnected')
              $app
                .logger()
                .warn(
                  'whatsapp_gap_fill: Instance disconnected due to auth error on messages fetch (3 strikes)',
                  'instance',
                  instanceName,
                  'auth_failure_count',
                  failures,
                )
            } else {
              $app
                .logger()
                .warn(
                  'whatsapp_gap_fill: Instance auth error on messages fetch, incrementing failure count',
                  'instance',
                  instanceName,
                  'auth_failure_count',
                  failures,
                )
            }
            $app.save(instance)
            hasMore = false
            break
          } else if (msgsRes.statusCode === 200) {
            if (instance.getInt('auth_failure_count') > 0) {
              instance.set('auth_failure_count', 0)
              $app.save(instance)
            }
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

      if (res.statusCode === 401 || res.statusCode === 403) {
        const failures = instance.getInt('auth_failure_count') + 1
        instance.set('auth_failure_count', failures)
        if (failures >= 3) {
          instance.set('status', 'disconnected')
          $app
            .logger()
            .warn(
              'sync_avatars: Instance disconnected due to auth error (3 strikes)',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        } else {
          $app
            .logger()
            .warn(
              'sync_avatars: Instance auth error, incrementing failure count',
              'instance',
              instanceName,
              'auth_failure_count',
              failures,
            )
        }
        $app.save(instance)
      } else if (res.statusCode === 200) {
        if (instance.getInt('auth_failure_count') > 0) {
          instance.set('auth_failure_count', 0)
          $app.save(instance)
        }
      }

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
