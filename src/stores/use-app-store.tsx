import React, { createContext, useContext, ReactNode } from 'react'

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

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AppContext.Provider
      value={{
        tags: [],
        chats: [],
        addTagToChat: () => {},
        removeTagFromChat: () => {},
        sendMessage: () => {},
        addTag: () => {},
        deleteTag: () => {},
      }}
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
