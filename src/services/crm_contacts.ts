import pb from '@/lib/pocketbase/client'

export const addToCrm = async (instanceName: string, jid: string) => {
  return pb.send('/backend/v1/crm/add-contact', {
    method: 'POST',
    body: JSON.stringify({ instance_name: instanceName, jid }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const getCrmContacts = async () => {
  return pb.collection('crm_contacts').getFullList({ sort: '-created' })
}

export const findCrmContactByJid = async (instanceName: string, jid: string) => {
  try {
    return await pb
      .collection('crm_contacts')
      .getFirstListItem(`instance_name="${instanceName}" && jid="${jid}"`)
  } catch {
    return null
  }
}

export const updateCrmContact = async (id: string, data: any) => {
  return pb.collection('crm_contacts').update(id, data)
}

export const deleteCrmContact = async (id: string) => {
  return pb.collection('crm_contacts').delete(id)
}
