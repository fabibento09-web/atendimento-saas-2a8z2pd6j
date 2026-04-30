import { useEffect, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 */
export function useRealtime(
  collectionName: string,
  callback: (data: RecordSubscription<any>) => void,
  enabled: boolean = true,
  onResync?: () => void,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const onResyncRef = useRef(onResync)
  onResyncRef.current = onResync

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let reconnectAttempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let lastEventAt = Date.now()

    const performResync = () => {
      if (onResyncRef.current) {
        onResyncRef.current()
      }
    }

    const subscribe = () => {
      if (cancelled) return

      pb.collection(collectionName)
        .subscribe('*', (e) => {
          lastEventAt = Date.now()
          reconnectAttempt = 0
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            lastEventAt = Date.now()
            reconnectAttempt = 0
          }
        })
        .catch(() => {
          if (cancelled) return
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000)
          reconnectAttempt += 1
          reconnectTimer = setTimeout(() => {
            subscribe()
          }, delay)
        })
    }

    subscribe()

    const heartbeatInterval = setInterval(() => {
      const now = Date.now()
      if (now - lastEventAt > 30000) {
        performResync()
        lastEventAt = Date.now()
      }
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performResync()
        if (unsubscribeFn) {
          unsubscribeFn().catch(() => {})
          unsubscribeFn = undefined
        }
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectAttempt = 0
        subscribe()
      }
    }

    const handleOnline = () => {
      performResync()
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
        unsubscribeFn = undefined
      }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectAttempt = 0
      subscribe()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      cancelled = true
      clearInterval(heartbeatInterval)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
