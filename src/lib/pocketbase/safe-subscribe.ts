import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'

export async function safeSubscribe<T = any>(
  collection: string,
  target: string,
  callback: (data: RecordSubscription<T>) => void,
  retryCount = 0,
): Promise<(() => Promise<void>) | undefined> {
  if (!pb.authStore.isValid) {
    console.warn(`Subscription to ${collection} aborted: Not authenticated.`)
    return undefined
  }

  try {
    const unsub = await pb.collection(collection).subscribe<T>(target, callback)
    return unsub
  } catch (error: any) {
    const errMessage = error?.message || String(error)
    const isClientIdError =
      errMessage.toLowerCase().includes('missing or invalid client id') ||
      errMessage.toLowerCase().includes('no client associated with connection id')

    if (isClientIdError) {
      console.warn('Realtime client ID error detected. Resetting global realtime connection...')
      await pb.realtime.unsubscribe().catch(() => {})
    }

    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      console.log(
        `Retrying subscription for ${collection} in ${delay}ms (attempt ${retryCount + 1}/3)...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      return safeSubscribe(collection, target, callback, retryCount + 1)
    } else {
      console.error(`Failed to subscribe to ${collection} after 3 retries.`, error)
      return undefined
    }
  }
}
