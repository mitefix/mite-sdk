type ErrorCallback = (error: Error, isFatal: boolean) => void

/**
 * Captures unhandled JS errors and promise rejections in React Native.
 */
export class ErrorHandler {
  private originalHandler: ErrorCallback | null = null
  private onError: ErrorCallback
  private installed = false

  constructor(onError: ErrorCallback) {
    this.onError = onError
  }

  /**
   * Install global error and promise rejection handlers.
   * Chains with any existing handlers so other error reporters still work.
   */
  install(): void {
    if (this.installed) return

    this.installGlobalErrorHandler()
    this.installPromiseRejectionHandler()
    this.installed = true
  }

  /**
   * Uninstall handlers and restore originals.
   */
  uninstall(): void {
    if (!this.installed) return

    this.restoreGlobalErrorHandler()
    this.installed = false
  }

  private installGlobalErrorHandler(): void {
    const g = globalThis as Record<string, unknown>
    const errorUtils = g.ErrorUtils as
      | {
          getGlobalHandler: () => ErrorCallback
          setGlobalHandler: (handler: ErrorCallback) => void
        }
      | undefined

    if (errorUtils) {
      this.originalHandler = errorUtils.getGlobalHandler()
      errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
        try {
          this.onError(error, isFatal)
        } catch {
          // Don't let our handler crash the app
        }
        if (this.originalHandler) {
          this.originalHandler(error, isFatal)
        }
      })
    }
  }

  private restoreGlobalErrorHandler(): void {
    const g = globalThis as Record<string, unknown>
    const errorUtils = g.ErrorUtils as
      | { setGlobalHandler: (handler: ErrorCallback) => void }
      | undefined

    if (errorUtils && this.originalHandler) {
      errorUtils.setGlobalHandler(this.originalHandler)
      this.originalHandler = null
    }
  }

  private installPromiseRejectionHandler(): void {
    const g = globalThis as Record<string, unknown>
    const prev = g.onunhandledrejection as
      | ((event: { reason: unknown }) => void)
      | undefined

    g.onunhandledrejection = (event: { reason: unknown }) => {
      try {
        const error =
          event?.reason instanceof Error
            ? event.reason
            : new Error(String(event?.reason ?? 'Unhandled promise rejection'))
        this.onError(error, false)
      } catch {
        // Don't let our handler crash the app
      }
      if (prev) prev(event)
    }
  }
}
