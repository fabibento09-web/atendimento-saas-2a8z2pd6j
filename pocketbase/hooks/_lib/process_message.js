module.exports = function processIncomingMessage(instanceName, data) {
  try {
    const key = data.key || {}
    const messageId = key.id || ''

    let record = null
    if (messageId) {
      try {
        record = $app.findFirstRecordByData('whatsapp_messages', 'message_id', messageId)
        const hasMedia = !!record.getString('media_file')

        let hasIncomingB64 = !!data.base64
        if (!hasIncomingB64 && data.message) {
          const msgStr = JSON.stringify(data.message)
          if (msgStr.includes('"base64":')) {
            hasIncomingB64 = true
          }
        }

        if (hasMedia || !hasIncomingB64) {
          return { status: 'ignored', reason: 'duplicate' }
        }
      } catch (_) {
        record = null
      }
    }

    const isEnrichment = !!(record && record.id)

    if (!record) {
      const col = $app.findCollectionByNameOrId('whatsapp_messages')
      record = new Record(col)
    }

    record.set('instance_name', instanceName)
    const remoteJid = key.remoteJid || ''
    record.set('remote_jid', remoteJid)
    record.set('from_me', !!key.fromMe)
    record.set('message_id', messageId)
    record.set('push_name', data.pushName || '')
    record.set('timestamp', data.messageTimestamp || 0)

    if (key.participant) {
      record.set('participant_jid', key.participant)
    }
    if (data.pushName) {
      record.set('participant_pushname', data.pushName)
    }

    let messageData = data.message || {}

    if (messageData.documentWithCaptionMessage && messageData.documentWithCaptionMessage.message) {
      messageData = messageData.documentWithCaptionMessage.message
    } else if (messageData.viewOnceMessageV2 && messageData.viewOnceMessageV2.message) {
      messageData = messageData.viewOnceMessageV2.message
    } else if (messageData.viewOnceMessage && messageData.viewOnceMessage.message) {
      messageData = messageData.viewOnceMessage.message
    } else if (messageData.ephemeralMessage && messageData.ephemeralMessage.message) {
      messageData = messageData.ephemeralMessage.message
    }

    const SYSTEM_KEYS = [
      'senderKeyDistributionMessage',
      'protocolMessage',
      'reactionMessage',
      'pollUpdateMessage',
      'keepInChatMessage',
      'messageContextInfo',
    ]

    const CONTENT_KEYS = [
      'conversation',
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'documentMessage',
      'stickerMessage',
      'locationMessage',
      'contactMessage',
      'contactsArrayMessage',
      'pollCreationMessage',
      'templateMessage',
      'liveLocationMessage',
      'groupInviteMessage',
    ]

    const msgKeys = Object.keys(messageData)
    const isEmpty = msgKeys.length === 0
    const hasUserContent = msgKeys.some((k) => CONTENT_KEYS.includes(k))
    const isOnlySystemKeys = msgKeys.every((k) => SYSTEM_KEYS.includes(k))

    if (isEmpty || (!hasUserContent && isOnlySystemKeys)) {
      return { status: 'ignored', reason: 'system_or_empty' }
    }

    let messageType = data.messageType || 'text'
    let content = ''
    let mediaMimetype = ''
    let mediaFilename = ''
    let caption = ''

    if (messageData.conversation) {
      content = messageData.conversation
    } else if (messageData.extendedTextMessage && messageData.extendedTextMessage.text) {
      content = messageData.extendedTextMessage.text
      const extMsg = messageData.extendedTextMessage
      if (extMsg.matchedText || extMsg.canonicalUrl || extMsg.title || extMsg.description) {
        record.set('link_title', extMsg.title || '')
        record.set('link_description', extMsg.description || '')
        record.set('link_url', extMsg.canonicalUrl || extMsg.matchedText || '')
        if (extMsg.jpegThumbnail) {
          let tb = extMsg.jpegThumbnail
          if (!tb.startsWith('data:')) {
            tb = 'data:image/jpeg;base64,' + tb
          }
          record.set('link_thumbnail_b64', tb)
        }
      }
    } else if (messageData.imageMessage) {
      messageType = 'image'
      mediaMimetype = messageData.imageMessage.mimetype
      caption = messageData.imageMessage.caption || ''
    } else if (messageData.videoMessage) {
      messageType = 'video'
      mediaMimetype = messageData.videoMessage.mimetype
      caption = messageData.videoMessage.caption || ''
    } else if (messageData.audioMessage) {
      messageType = 'audio'
      mediaMimetype = messageData.audioMessage.mimetype
    } else if (messageData.documentMessage) {
      messageType = 'document'
      mediaMimetype = messageData.documentMessage.mimetype
      mediaFilename =
        messageData.documentMessage.fileName || messageData.documentMessage.title || ''
      caption = messageData.documentMessage.caption || ''
    } else if (messageData.stickerMessage) {
      messageType = 'sticker'
      mediaMimetype = messageData.stickerMessage.mimetype
    } else if (
      messageData.pollCreationMessage ||
      messageData.templateMessage ||
      messageData.liveLocationMessage ||
      messageData.groupInviteMessage
    ) {
      messageType = 'unsupported'
      content = '[mensagem não suportada]'
    } else {
      $app.logger().warn('Unknown message type', 'keys', Object.keys(messageData).join(','))
      return { status: 'ignored', reason: 'unknown_type' }
    }

    const finalContent = content || caption || ''
    record.set('message_type', messageType)
    record.set('content', finalContent)
    record.set('caption', caption)
    record.set('media_mimetype', mediaMimetype || '')
    record.set('media_filename', mediaFilename || '')

    if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
      let b64 = null
      let source = ''

      if (messageData.base64) {
        b64 = messageData.base64
        source = 'data.message.base64'
      } else if (
        messageData[`${messageType}Message`] &&
        messageData[`${messageType}Message`].base64
      ) {
        b64 = messageData[`${messageType}Message`].base64
        source = `data.message.${messageType}Message.base64`
      } else if (data.base64) {
        b64 = data.base64
        source = 'data.base64'
      }

      if (b64) {
        $app.logger().info(`Using base64 from payload: ${source}`)
      } else {
        const apiUrl = $secrets.get('EVOLUTION_API_URL')
        const apiKey = $secrets.get('EVOLUTION_API_KEY')
        const baseUrl = apiUrl && apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

        if (baseUrl && apiKey) {
          try {
            const res = $http.send({
              url: `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
              method: 'POST',
              headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: { key: key, message: messageData },
                convertToMp4: false,
              }),
              timeout: 30,
            })

            if (res.statusCode === 401 || res.statusCode === 403) {
              try {
                const instance = $app.findFirstRecordByData(
                  'whatsapp_instances',
                  'instance_name',
                  instanceName,
                )
                const failures = instance.getInt('auth_failure_count') + 1
                instance.set('auth_failure_count', failures)
                if (failures >= 3) {
                  instance.set('status', 'disconnected')
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance disconnected due to auth error (3 strikes)',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                } else {
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance auth error, incrementing failure count',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                }
                $app.save(instance)
              } catch (_) {}
            } else if (res.statusCode === 200) {
              try {
                const instance = $app.findFirstRecordByData(
                  'whatsapp_instances',
                  'instance_name',
                  instanceName,
                )
                if (instance.getInt('auth_failure_count') > 0) {
                  instance.set('auth_failure_count', 0)
                  $app.save(instance)
                }
              } catch (_) {}
            }

            if (res.statusCode === 200 && res.json && res.json.base64) {
              b64 = res.json.base64
              $app.logger().info('Using base64 from HTTP API call')
            } else {
              $app
                .logger()
                .error(
                  'Failed to get base64 media',
                  'status',
                  res.statusCode,
                  'body',
                  res.json ? JSON.stringify(res.json) : 'unknown',
                )
            }
          } catch (err) {
            $app.logger().error('Error fetching base64 media', 'error', err.message)
          }
        }
      }

      if (!b64) {
        $app.logger().error('Base64 media data is missing or empty')
        record.set('status', 'media_failed')
        record.set('media_url', '')
      } else {
        try {
          let b64Data = b64
            .split(',')
            .pop()
            .replace(/[^A-Za-z0-9\+\/=]/g, '')

          while (b64Data.length % 4 !== 0) {
            b64Data += '='
          }

          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
          const lookup = {}
          for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i

          const bytes = new Uint8Array(b64Data.length * 0.75)
          let p = 0
          for (let i = 0; i < b64Data.length; i += 4) {
            const c1 = lookup[b64Data.charCodeAt(i)]
            const c2 = lookup[b64Data.charCodeAt(i + 1)]
            const c3 = lookup[b64Data.charCodeAt(i + 2)]
            const c4 = lookup[b64Data.charCodeAt(i + 3)]
            if (c1 !== undefined && c2 !== undefined) {
              bytes[p++] = (c1 << 2) | (c2 >> 4)
              if (c3 !== undefined) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2)
              if (c4 !== undefined) bytes[p++] = ((c3 & 3) << 6) | (c4 & 63)
            }
          }
          const actualBytes = bytes.slice(0, p)

          const ext = (mediaMimetype || '').split('/')[1]?.split(';')[0] || 'bin'
          const finalFilename = mediaFilename || `${$security.randomString(8)}.${ext}`
          record.set('media_filename', finalFilename)

          const file = $filesystem.fileFromBytes(actualBytes, finalFilename)
          record.set('media_file', file)
          record.set('status', 'success')
        } catch (err) {
          $app.logger().error('Failed to decode and save base64 media', 'error', err.message)
          record.set('status', 'media_failed')
        }
      }
    } else {
      record.set('status', 'success')
    }

    $app.save(record)

    if (record.getString('media_file')) {
      const pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
      if (pbUrl) {
        const fileUrl = `${pbUrl.endsWith('/') ? pbUrl.slice(0, -1) : pbUrl}/api/files/whatsapp_messages/${record.id}/${record.getString('media_file')}`
        record.set('media_url', fileUrl)
        $app.saveNoValidate(record)
      }
    }

    // Sync Conversation
    if (remoteJid && remoteJid !== 'status@broadcast') {
      let instanceRecord
      try {
        instanceRecord = $app.findFirstRecordByData(
          'whatsapp_instances',
          'instance_name',
          instanceName,
        )
      } catch (_) {}

      if (instanceRecord) {
        const userId = instanceRecord.getString('user_id')
        const isGroup = remoteJid.includes('@g.us') || !!data.isGroup
        const chatType = isGroup ? 'group' : 'individual'

        let convRecord
        try {
          convRecord = $app.findFirstRecordByFilter(
            'conversations',
            'user_id = {:userId} && remote_jid = {:remoteJid} && instance_name = {:instanceName}',
            { userId, remoteJid, instanceName },
          )
        } catch (_) {
          const convCol = $app.findCollectionByNameOrId('conversations')
          convRecord = new Record(convCol)
          convRecord.set('user_id', userId)
          convRecord.set('remote_jid', remoteJid)
          convRecord.set('instance_name', instanceName)
          convRecord.set('is_group', isGroup)
          convRecord.set('type', chatType)
          convRecord.set('contact_phone', remoteJid.split('@')[0])
        }

        if (chatType === 'individual' && data.pushName) {
          convRecord.set('contact_name', data.pushName)
        }
        convRecord.set(
          'last_message',
          finalContent || (messageType !== 'text' ? `[${messageType}]` : ''),
        )

        if (!isEnrichment) {
          if (!key.fromMe) {
            const currentUnread = convRecord.getInt('unread_count') || 0
            convRecord.set('unread_count', currentUnread + 1)
          } else {
            convRecord.set('unread_count', 0)
          }
        }

        const apiUrl = $secrets.get('EVOLUTION_API_URL')
        const apiKey = $secrets.get('EVOLUTION_API_KEY')
        const baseUrl = apiUrl && apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

        // Retrieve group name if missing
        if (chatType === 'group' && !convRecord.getString('contact_name') && baseUrl && apiKey) {
          try {
            const res = $http.send({
              url: `${baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${remoteJid}`,
              method: 'GET',
              headers: { apikey: apiKey },
              timeout: 5,
            })
            if (res.statusCode === 401 || res.statusCode === 403) {
              try {
                const failures = instanceRecord.getInt('auth_failure_count') + 1
                instanceRecord.set('auth_failure_count', failures)
                if (failures >= 3) {
                  instanceRecord.set('status', 'disconnected')
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance disconnected due to auth error on group info (3 strikes)',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                } else {
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance auth error on group info, incrementing failure count',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                }
                $app.save(instanceRecord)
              } catch (_) {}
            } else if (res.statusCode === 200) {
              try {
                if (instanceRecord.getInt('auth_failure_count') > 0) {
                  instanceRecord.set('auth_failure_count', 0)
                  $app.save(instanceRecord)
                }
              } catch (_) {}
            }
            if (res.statusCode === 200 && res.json && res.json.subject) {
              convRecord.set('contact_name', res.json.subject)
            }
          } catch (e) {
            $app.logger().warn('Failed to fetch group info', 'error', e.message)
          }
        }

        const now = new Date()
        const fetchedAtStr = convRecord.getString('picture_fetched_at')
        let needsFetch = !convRecord.getString('avatar')
        if (fetchedAtStr && !needsFetch) {
          const fetchedAt = new Date(fetchedAtStr)
          if (now.getTime() - fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
            needsFetch = true
          }
        }

        if (needsFetch && baseUrl && apiKey) {
          try {
            const res = $http.send({
              url: `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
              method: 'POST',
              headers: { apikey: apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: remoteJid }),
              timeout: 10,
            })
            if (res.statusCode === 401 || res.statusCode === 403) {
              try {
                const failures = instanceRecord.getInt('auth_failure_count') + 1
                instanceRecord.set('auth_failure_count', failures)
                if (failures >= 3) {
                  instanceRecord.set('status', 'disconnected')
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance disconnected due to auth error on avatar fetch (3 strikes)',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                } else {
                  $app
                    .logger()
                    .warn(
                      'process_message: Instance auth error on avatar fetch, incrementing failure count',
                      'instance',
                      instanceName,
                      'auth_failure_count',
                      failures,
                    )
                }
                $app.save(instanceRecord)
              } catch (_) {}
            } else if (res.statusCode === 200) {
              try {
                if (instanceRecord.getInt('auth_failure_count') > 0) {
                  instanceRecord.set('auth_failure_count', 0)
                  $app.save(instanceRecord)
                }
              } catch (_) {}
            }
            if (res.statusCode === 200 && res.json && res.json.profilePictureUrl) {
              const file = $filesystem.fileFromURL(res.json.profilePictureUrl)
              convRecord.set('avatar', file)
            }
          } catch (e) {
            $app.logger().warn('Failed to fetch/save avatar', 'error', e.message)
          }
          // Update fetch time regardless of success to avoid endless retry loops
          convRecord.set('picture_fetched_at', new Date().toISOString())
        }

        $app.save(convRecord)
      }
    }
    return { status: 'success' }
  } catch (err) {
    $app.logger().error('Failed to save message or sync conversation', 'error', err.message)
    return { status: 'error', reason: err.message }
  }
}
