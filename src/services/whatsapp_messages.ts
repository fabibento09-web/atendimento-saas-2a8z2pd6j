import pb from '@/lib/pocketbase/client'

export interface WhatsAppMessage {
  id: string
  instance_name: string
  remote_jid: string
  from_me: boolean
  message_id: string
  push_name: string
  content: string
  message_type: string
  timestamp: number
  created: string
  updated: string
  media_url?: string
  media_mimetype?: string
  media_filename?: string
  caption?: string
  media_type?: string
  link_title?: string
  link_description?: string
  link_url?: string
  link_thumbnail_b64?: string
}

export const getWhatsAppMessages = (instanceName: string, remoteJid: string) => {
  return pb.collection('whatsapp_messages').getFullList<WhatsAppMessage>({
    filter: `instance_name = "${instanceName}" && remote_jid = "${remoteJid}"`,
    sort: 'timestamp',
  })
}

export const getAllMessagesForInstance = (instanceName: string) => {
  return pb.collection('whatsapp_messages').getFullList<WhatsAppMessage>({
    filter: `instance_name = "${instanceName}"`,
    sort: '-timestamp',
  })
}

export const sendWhatsAppMessage = (instanceName: string, number: string, text: string) => {
  return pb.send('/backend/v1/whatsapp/send-message', {
    method: 'POST',
    body: JSON.stringify({ instanceName, number, text }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendWhatsAppMedia = async (
  instanceName: string,
  number: string,
  mediatype: 'image' | 'video' | 'document' | 'audio',
  file: File,
  caption: string = '',
) => {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result as string
      const base64Data = result.split(',')[1]

      const formData = new FormData()
      formData.append('instanceName', instanceName)
      formData.append('number', number)
      formData.append('mediatype', mediatype)
      formData.append('caption', caption)
      formData.append('mimetype', file.type)
      formData.append('fileName', file.name)
      formData.append('base64', base64Data)
      formData.append('file', file)

      try {
        const response = await pb.send('/backend/v1/whatsapp/send-media', {
          method: 'POST',
          body: formData,
        })
        resolve(response)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}
