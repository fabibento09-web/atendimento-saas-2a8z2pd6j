import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'

// Global promise queue: serializes subscribes across the app so multiple
// useRealtime hooks don't race against each other before the SSE connection
// is established. Each new subscribe waits for the previous to settle.
let subscribeQueue: Promise<unknown> = Promise.resolve()

export async function safeSubscribe<T = any>(
  collection: string,
  target: string,
  callback: (data: RecordSubscription<T>) => void,
): Promise<(() => Promise<void>) | undefined> {
  if (!pb.authStore.isValid) {
    return undefined
  }

  const next = subscribeQueue
    .catch(() => undefined)
    .then(() => doSubscribe(collection, target, callback, 0))
  subscribeQueue = next
  return next
}

async function doSubscribe<T>(
  collection: string,
  target: string,
  callback: (data: RecordSubscription<T>) => void,
  retryCount: number,
): Promise<(() => Promise<void>) | undefined> {
  if (!pb.authStore.isValid) return undefined

  try {
    return await pb.collection(collection).subscribe<T>(target, callback)
  } catch (error: any) {
    const errMessage = error?.message || String(error)
    const isClientIdError =
      errMessage.toLowerCase().includes('missing or invalid client id') ||
      errMessage.toLowerCase().includes('no client associated with connection id')

    if (retryCount >= 4) {
      console.error(`safeSubscribe: gave up on ${collection} after ${retryCount} retries`, error)
      return undefined
    }

    // Client id mismatches resolve fast once SSE stabilizes — short delay.
    // Other errors back off normally.
    const delay = isClientIdError ? 250 : Math.pow(2, retryCount) * 500
    await new Promise((resolve) => setTimeout(resolve, delay))
    return doSubscribe(collection, target, callback, retryCount + 1)
  }
}
