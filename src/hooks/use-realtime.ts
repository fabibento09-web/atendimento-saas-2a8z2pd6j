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
  onReconnect?: () => void,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let retryCount = 0
    let retryTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      if (cancelled) return

      pb.collection(collectionName)
        .subscribe('*', (e) => {
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            if (retryCount > 0) {
              if (onReconnectRef.current) onReconnectRef.current()
            }
            retryCount = 0
          }
        })
        .catch(() => {
          if (!cancelled) {
            retryCount++
            retryTimeout = setTimeout(connect, Math.min(1000 * Math.pow(2, retryCount), 30000))
          }
        })
    }

    connect()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && onReconnectRef.current) {
        onReconnectRef.current()
      }
    }

    const handleFocus = () => {
      if (document.visibilityState === 'visible' && onReconnectRef.current) {
        onReconnectRef.current()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      clearTimeout(retryTimeout)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [collectionName, enabled])
}

export default useRealtime
