import { afterEach, describe, expect, it, mock } from 'bun:test'
import { MiteError } from '../errors'
import { HttpClient } from '../http'

const originalFetch = globalThis.fetch

function makeClient(
  overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {},
) {
  return new HttpClient({
    baseUrl: 'https://api.test',
    apiKey: 'test-key',
    timeout: 1000,
    maxRetries: 2,
    ...overrides,
  })
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('HttpClient', () => {
  it('sends Authorization header and parses JSON', async () => {
    const fetchMock = mock(async () => jsonResponse({ ok: true }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await makeClient().get<{ ok: boolean }>('/api/v1/health')

    expect(result.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/api/v1/health')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('serializes query params and skips undefined values', async () => {
    const fetchMock = mock(async () => jsonResponse({}))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await makeClient().get('/api/v1/releases', {
      query: { platform: 'ios', limit: 10, missing: undefined },
    })

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://api.test/api/v1/releases?platform=ios&limit=10')
  })

  it('throws MiteError with status and server message on failure', async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ error: 'Missing required field: title' }, 400),
    ) as unknown as typeof fetch

    const promise = makeClient().post('/api/v1/bug-reports', {})
    await expect(promise).rejects.toBeInstanceOf(MiteError)
    await promise.catch((error: MiteError) => {
      expect(error.status).toBe(400)
      expect(error.message).toBe('[Mite] Missing required field: title')
    })
  })

  it('exposes retryAfter on rate-limited requests', async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '30' }),
    ) as unknown as typeof fetch

    await makeClient({ maxRetries: 0 })
      .get('/api/v1/releases')
      .catch((error: MiteError) => {
        expect(error.isRateLimited).toBe(true)
        expect(error.retryAfter).toBe(30)
      })
  })

  it('retries GET requests on 500 and succeeds', async () => {
    let calls = 0
    globalThis.fetch = mock(async () => {
      calls++
      return calls < 2
        ? jsonResponse({ error: 'boom' }, 500)
        : jsonResponse({ releases: [] })
    }) as unknown as typeof fetch

    const result = await makeClient().get<{ releases: unknown[] }>('/api/v1/releases')

    expect(calls).toBe(2)
    expect(result.releases).toEqual([])
  })

  it('does not retry POST requests', async () => {
    let calls = 0
    globalThis.fetch = mock(async () => {
      calls++
      return jsonResponse({ error: 'boom' }, 500)
    }) as unknown as typeof fetch

    await expect(makeClient().post('/api/v1/bug-reports', {})).rejects.toBeInstanceOf(
      MiteError,
    )
    expect(calls).toBe(1)
  })

  it('does not retry GET requests on 4xx errors', async () => {
    let calls = 0
    globalThis.fetch = mock(async () => {
      calls++
      return jsonResponse({ error: 'Invalid API key' }, 401)
    }) as unknown as typeof fetch

    await makeClient()
      .get('/api/v1/releases')
      .catch((error: MiteError) => {
        expect(error.isAuthError).toBe(true)
      })
    expect(calls).toBe(1)
  })

  it('wraps network failures in MiteError', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch

    await expect(makeClient({ maxRetries: 0 }).get('/x')).rejects.toBeInstanceOf(
      MiteError,
    )
  })
})
