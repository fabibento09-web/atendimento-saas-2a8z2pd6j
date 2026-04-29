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
