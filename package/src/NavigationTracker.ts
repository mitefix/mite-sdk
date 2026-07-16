import type { NavigationBreadcrumb } from './types'

export const DEFAULT_MAX_NAVIGATION_BREADCRUMBS = 20

interface NavigationTrackerOptions {
  enabled?: boolean
  maxBreadcrumbs?: number
}

export class NavigationTracker {
  private breadcrumbs: NavigationBreadcrumb[] = []
  private enabled = true
  private maxBreadcrumbs = DEFAULT_MAX_NAVIGATION_BREADCRUMBS

  configure(options: NavigationTrackerOptions): void {
    if (typeof options.enabled === 'boolean') {
      this.enabled = options.enabled
      if (!options.enabled) {
        this.breadcrumbs = []
      }
    }

    if (typeof options.maxBreadcrumbs === 'number' && options.maxBreadcrumbs > 0) {
      this.maxBreadcrumbs = Math.floor(options.maxBreadcrumbs)
      if (this.breadcrumbs.length > this.maxBreadcrumbs) {
        this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs)
      }
    }
  }

  record(screen: string): void {
    if (!this.enabled || typeof screen !== 'string') {
      return
    }

    const trimmedScreen = screen.trim()
    if (!trimmedScreen) {
      return
    }

    const lastBreadcrumb = this.breadcrumbs[this.breadcrumbs.length - 1]
    if (lastBreadcrumb?.screen === trimmedScreen) {
      return
    }

    this.breadcrumbs.push({ screen: trimmedScreen, timestamp: Date.now() })

    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs)
    }
  }

  getTrail(): NavigationBreadcrumb[] {
    return this.breadcrumbs.map(breadcrumb => ({ ...breadcrumb }))
  }

  clear(): void {
    this.breadcrumbs = []
  }
}

export const navigationTracker = new NavigationTracker()

/**
 * Manually record a screen view in the navigation trail attached to bug reports.
 * Useful when not using React Navigation or Expo Router, or for custom flows.
 */
export function recordNavigationBreadcrumb(screen: string): void {
  navigationTracker.record(screen)
}

/**
 * Get the current navigation trail (oldest screen first).
 */
export function getNavigationTrail(): NavigationBreadcrumb[] {
  return navigationTracker.getTrail()
}

/**
 * Clear all recorded navigation breadcrumbs.
 */
export function clearNavigationTrail(): void {
  navigationTracker.clear()
}
