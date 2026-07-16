interface StoreReviewModule {
  isAvailableAsync(): Promise<boolean>
  requestReview(): Promise<void>
}

let cachedModule: StoreReviewModule | null | undefined
let warnedMissingModule = false

function loadStoreReviewModule(): StoreReviewModule | null {
  if (cachedModule !== undefined) {
    return cachedModule
  }

  try {
    const storeReview = require('expo-store-review') as Partial<StoreReviewModule>

    if (
      typeof storeReview?.isAvailableAsync === 'function' &&
      typeof storeReview?.requestReview === 'function'
    ) {
      cachedModule = storeReview as StoreReviewModule
    } else {
      cachedModule = null
    }
  } catch {
    cachedModule = null
  }

  if (!cachedModule && !warnedMissingModule) {
    warnedMissingModule = true
    console.warn(
      '[Mite] expo-store-review is not installed. Store review requests will be skipped. Install expo-store-review to enable them.',
    )
  }

  return cachedModule
}

/**
 * Check whether the native store review dialog can be requested on this device.
 * Returns false when the optional expo-store-review dependency is missing.
 */
export async function isStoreReviewAvailable(): Promise<boolean> {
  const storeReview = loadStoreReviewModule()

  if (!storeReview) {
    return false
  }

  try {
    return await storeReview.isAvailableAsync()
  } catch (err) {
    console.warn('[Mite] Failed to check store review availability:', err)
    return false
  }
}

/**
 * Request the native store review dialog via expo-store-review.
 * Resolves to true when the request was made, false when the optional
 * dependency is missing or the dialog is unavailable on this device.
 */
export async function requestStoreReview(): Promise<boolean> {
  const storeReview = loadStoreReviewModule()

  if (!storeReview) {
    return false
  }

  try {
    const available = await storeReview.isAvailableAsync()

    if (!available) {
      console.log('[Mite] Store review is not available on this device')
      return false
    }

    await storeReview.requestReview()
    return true
  } catch (err) {
    console.warn('[Mite] Failed to request store review:', err)
    return false
  }
}
