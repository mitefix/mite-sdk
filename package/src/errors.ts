/**
 * Error thrown by all Mite SDK methods when a request fails.
 * Carries the HTTP status and, for rate-limited requests, the
 * number of seconds to wait before retrying.
 */
export class MiteError extends Error {
  readonly status?: number
  readonly retryAfter?: number

  constructor(
    message: string,
    options: { status?: number; retryAfter?: number; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'MiteError'
    this.status = options.status
    this.retryAfter = options.retryAfter
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}
