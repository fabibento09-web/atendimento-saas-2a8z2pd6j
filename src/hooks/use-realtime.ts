import { useEffect, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'
import { safeSubscribe } from '@/lib/pocketbase/safe-subscribe'
import { useAuth } from '@/hooks/use-auth'

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
  const { user } = useAuth()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || !pb.authStore.isValid) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    safeSubscribe(collectionName, '*', (e) => {
      callbackRef.current(e)
    }).then((fn) => {
      if (cancelled) {
        if (fn) fn().catch(() => {})
      } else if (fn) {
        unsubscribeFn = fn
      }
    })

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled, user])
}

export default useRealtime
