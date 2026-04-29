import pb from '@/lib/pocketbase/client'

export interface WhatsAppInstance {
  id: string
  user_id: string
  instance_name: string
  instance_id: string
  instance_hash: string
  status: 'creating' | 'qrcode' | 'connected' | 'disconnected'
  phone_number?: string
  created: string
  updated: string
}

export const getWhatsAppInstances = () =>
  pb.collection('whatsapp_instances').getFullList<WhatsAppInstance>()

export const getWhatsAppInstance = (id: string) =>
  pb.collection('whatsapp_instances').getOne<WhatsAppInstance>(id)

export const createWhatsAppInstance = (data: Partial<WhatsAppInstance>) =>
  pb.collection('whatsapp_instances').create<WhatsAppInstance>(data)

export const updateWhatsAppInstance = (id: string, data: Partial<WhatsAppInstance>) =>
  pb.collection('whatsapp_instances').update<WhatsAppInstance>(id, data)

export const deleteWhatsAppInstance = (id: string) => pb.collection('whatsapp_instances').delete(id)

export const checkWhatsAppInstanceStatus = (instanceName: string) =>
  pb.send<{ status: 'qrcode' | 'connected' | 'disconnected'; qrcodeBase64?: string }>(
    `/backend/v1/whatsapp/instance-status?instanceName=${encodeURIComponent(instanceName)}`,
    { method: 'GET' },
  )

export const createWhatsAppInstanceApi = (instanceName: string) =>
  pb.send<{ status: string; qrcodeBase64?: string }>('/backend/v1/whatsapp/create-instance', {
    method: 'POST',
    body: JSON.stringify({ instanceName }),
  })

export const disconnectWhatsAppInstanceApi = (instanceName: string) =>
  pb.send<{ success: boolean }>('/backend/v1/whatsapp/disconnect', {
    method: 'POST',
    body: JSON.stringify({ instanceName }),
  })
