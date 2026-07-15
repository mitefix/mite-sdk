import { useEffect } from 'react'
import { navigationTracker } from './NavigationTracker'

/**
 * Minimal structural shape of a navigation container ref. Matches the refs
 * returned by React Navigation's createNavigationContainerRef /
 * useNavigationContainerRef and Expo Router's useNavigationContainerRef,
 * without requiring either library to be installed.
 */
export interface MiteNavigationContainerRefLike {
  isReady?: () => boolean
  getCurrentRoute?: () => { name: string } | undefined
  addListener?: (type: 'state', callback: () => void) => () => void
}

/**
 * Track screen changes from React Navigation or Expo Router and attach the
 * navigation trail to submitted bug reports.
 *
 * React Navigation:
 * ```tsx
 * const navigationRef = useNavigationContainerRef()
 * useMiteNavigationTracking(navigationRef)
 * return <NavigationContainer ref={navigationRef}>...</NavigationContainer>
 * ```
 *
 * Expo Router (in the root layout):
 * ```tsx
 * useMiteNavigationTracking(useNavigationContainerRef())
 * ```
 */
export function useMiteNavigationTracking(
  navigationRef: MiteNavigationContainerRefLike | null | undefined,
): void {
  useEffect(() => {
    if (
      !navigationRef ||
      typeof navigationRef.addListener !== 'function' ||
      typeof navigationRef.getCurrentRoute !== 'function'
    ) {
      console.warn(
        '[Mite] useMiteNavigationTracking received an invalid navigation container ref. Navigation breadcrumbs are disabled. Pass the ref from React Navigation or Expo Router useNavigationContainerRef().',
      )
      return
    }

    const recordCurrentRoute = () => {
      try {
        const route = navigationRef.getCurrentRoute?.()
        if (route?.name) {
          navigationTracker.record(route.name)
        }
      } catch (err) {
        console.warn('[Mite] Failed to record navigation breadcrumb:', err)
      }
    }

    try {
      if (navigationRef.isReady?.()) {
        recordCurrentRoute()
      }
    } catch {
      // The container may not be ready yet. The state listener below will
      // record the first route once navigation is ready.
    }

    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = navigationRef.addListener('state', recordCurrentRoute)
    } catch (err) {
      console.warn('[Mite] Failed to subscribe to navigation state changes:', err)
      return
    }

    return () => {
      try {
        unsubscribe?.()
      } catch {
        // Ignore unsubscribe errors during teardown.
      }
    }
  }, [navigationRef])
}
