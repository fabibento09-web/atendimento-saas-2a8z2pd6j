import React, { createContext, useContext, useState, ReactNode } from 'react'

export type Tag = { id: string; name: string; color: string }
export type Message = { id: string; text: string; sender: 'me' | 'them'; timestamp: string }
export type Chat = {
  id: string
  contactName: string
  avatar?: string
  lastMessage: string
  timestamp: string
  unread: number
  tags: string[]
  messages: Message[]
}

type AppState = {
  tags: Tag[]
  chats: Chat[]
  addTagToChat: (chatId: string, tagId: string) => void
  removeTagFromChat: (chatId: string, tagId: string) => void
  sendMessage: (chatId: string, text: string) => void
  addTag: (tag: Omit<Tag, 'id'>) => void
  deleteTag: (tagId: string) => void
}

const AppContext = createContext<AppState | null>(null)

const INITIAL_TAGS: Tag[] = [
  { id: '1', name: 'Suporte', color: '#3b82f6' },
  { id: '2', name: 'Vendas', color: '#10b981' },
  { id: '3', name: 'Urgente', color: '#ef4444' },
  { id: '4', name: 'Dúvidas', color: '#f59e0b' },
]

const INITIAL_CHATS: Chat[] = [
  {
    id: 'c1',
    contactName: 'Mariana Costa',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=1',
    lastMessage: 'Perfeito, aguardo o envio.',
    timestamp: '10:30',
    unread: 0,
    tags: ['1'],
    messages: [
      {
        id: 'm1',
        text: 'Olá, gostaria de saber o status do meu pedido.',
        sender: 'them',
        timestamp: '10:00',
      },
      {
        id: 'm2',
        text: 'Olá Mariana! Seu pedido já está em rota de entrega.',
        sender: 'me',
        timestamp: '10:15',
      },
      { id: 'm3', text: 'Perfeito, aguardo o envio.', sender: 'them', timestamp: '10:30' },
    ],
  },
  {
    id: 'c2',
    contactName: 'Carlos Silva',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=2',
    lastMessage: 'Minha fatura veio com valor incorreto!',
    timestamp: '09:45',
    unread: 2,
    tags: ['3', '1'],
    messages: [
      { id: 'm4', text: 'Bom dia.', sender: 'them', timestamp: '09:44' },
      {
        id: 'm5',
        text: 'Minha fatura veio com valor incorreto!',
        sender: 'them',
        timestamp: '09:45',
      },
    ],
  },
  {
    id: 'c3',
    contactName: 'Empresa XYZ',
    avatar: 'https://img.usecurling.com/i?q=company&shape=fill',
    lastMessage: 'Podemos agendar uma reunião?',
    timestamp: 'Ontem',
    unread: 1,
    tags: ['2'],
    messages: [
      {
        id: 'm6',
        text: 'Gostaríamos de conhecer a plataforma.',
        sender: 'them',
        timestamp: '15:00',
      },
      { id: 'm7', text: 'Podemos agendar uma reunião?', sender: 'them', timestamp: '15:01' },
    ],
  },
  {
    id: 'c4',
    contactName: 'Fernanda Oliveira',
    avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=4',
    lastMessage: 'Vocês atendem finais de semana?',
    timestamp: 'Ontem',
    unread: 0,
    tags: ['4'],
    messages: [
      { id: 'm8', text: 'Vocês atendem finais de semana?', sender: 'them', timestamp: '11:20' },
      { id: 'm9', text: 'Olá Fernanda, apenas dias úteis.', sender: 'me', timestamp: '11:45' },
    ],
  },
]

export function AppProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<Tag[]>(INITIAL_TAGS)
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)

  const addTagToChat = (chatId: string, tagId: string) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId && !c.tags.includes(tagId)) {
          return { ...c, tags: [...c.tags, tagId] }
        }
        return c
      }),
    )
  }

  const removeTagFromChat = (chatId: string, tagId: string) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId) {
          return { ...c, tags: c.tags.filter((t) => t !== tagId) }
        }
        return c
      }),
    )
  }

  const sendMessage = (chatId: string, text: string) => {
    const newMessage: Message = {
      id: Math.random().toString(),
      text,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: [...c.messages, newMessage],
            lastMessage: text,
            timestamp: newMessage.timestamp,
          }
        }
        return c
      }),
    )
  }

  const addTag = (tag: Omit<Tag, 'id'>) => {
    setTags((prev) => [...prev, { ...tag, id: Math.random().toString() }])
  }

  const deleteTag = (tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    setChats((prev) => prev.map((c) => ({ ...c, tags: c.tags.filter((t) => t !== tagId) })))
  }

  return (
    <AppContext.Provider
      value={{ tags, chats, addTagToChat, removeTagFromChat, sendMessage, addTag, deleteTag }}
    >
      {children}
    </AppContext.Provider>
  )
}

export default function useAppStore() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppStore must be used within AppProvider')
  return context
}
