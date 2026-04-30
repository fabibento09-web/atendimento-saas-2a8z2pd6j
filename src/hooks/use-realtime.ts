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
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

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
            retryCount = 0 // reset on success
          }
        })
        .catch((err) => {
          if (cancelled) return
          console.warn(`[Realtime] Subscription error for ${collectionName}:`, err?.message || err)

          // Exponential backoff retry (max 30s)
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
          retryCount++

          console.log(`[Realtime] Retrying subscription to ${collectionName} in ${delay}ms...`)
          retryTimeout = setTimeout(connect, delay)
        })
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(retryTimeout)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
