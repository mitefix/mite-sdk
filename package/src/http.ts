import { MiteError } from './errors'

// React Native and Bun (used for tests) ship structurally incompatible
// fetch/AbortSignal global types; the request shape below is valid in both.
type FetchLike = (input: string, init?: unknown) => Promise<Response>

export interface HttpClientConfig {
  baseUrl: string
  apiKey: string
  timeout: number
  maxRetries: number
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>
}

export class HttpClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number
  private maxRetries: number

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout
    this.maxRetries = config.maxRetries
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options.query)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = `${this.baseUrl}${path}`
    if (!query) return url
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.append(key, String(value))
    }
    const queryString = params.toString()
    return queryString ? `${url}?${queryString}` : url
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: RequestOptions['query'],
  ): Promise<T> {
    const url = this.buildUrl(path, query)
    // Only GETs are retried: retrying a failed POST could create
    // duplicate bug reports or votes on the server.
    const maxAttempts = method === 'GET' ? this.maxRetries + 1 : 1
    let lastError: MiteError | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const backoff =
          lastError?.retryAfter !== undefined
            ? lastError.retryAfter * 1000
            : Math.min(1000 * 2 ** attempt, 10000)
        await new Promise<void>(resolve => setTimeout(resolve, backoff))
      }

      try {
        return await this.send<T>(method, url, body)
      } catch (error) {
        lastError = error instanceof MiteError ? error : new MiteError(String(error))
        const retryable =
          lastError.status === undefined ||
          lastError.status >= 500 ||
          lastError.status === 429
        if (!retryable) throw lastError
      }
    }

    throw lastError ?? new MiteError('[Mite] Request failed')
  }

  private async send<T>(method: string, url: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response: Response
    try {
      response = await (fetch as FetchLike)(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      throw new MiteError(
        aborted
          ? `[Mite] Request timed out after ${this.timeout}ms`
          : `[Mite] Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      let message = `[Mite] Request failed with status ${response.status}`
      try {
        const data = (await response.json()) as { error?: string }
        if (data.error) message = `[Mite] ${data.error}`
      } catch {}
      const retryAfterHeader = response.headers.get('Retry-After')
      const retryAfter = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : undefined
      throw new MiteError(message, {
        status: response.status,
        retryAfter: Number.isNaN(retryAfter) ? undefined : retryAfter,
      })
    }

    return (await response.json()) as T
  }
}
