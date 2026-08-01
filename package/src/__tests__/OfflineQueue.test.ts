import { OfflineQueue } from '../OfflineQueue'
import type { ApiClient } from '../utils/client'

function createMockApiClient(postFn?: jest.Mock, putFn?: jest.Mock): ApiClient {
  return {
    post: postFn ?? jest.fn().mockResolvedValue({}),
    put: putFn ?? jest.fn().mockResolvedValue({}),
    get: jest.fn(),
    delete: jest.fn(),
    getAxiosInstance: jest.fn(),
    updateHeaders: jest.fn(),
  } as unknown as ApiClient
}

describe('OfflineQueue', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    jest.useRealTimers()
  })

  it('enqueues a request', () => {
    const client = createMockApiClient()
    const queue = new OfflineQueue(client)

    queue.enqueue('post', '/api/v1/bug-reports', { title: 'test' })

    expect(queue.pendingCount).toBe(1)
    queue.destroy()
  })

  it('flushes queued requests successfully', async () => {
    const postFn = jest.fn().mockResolvedValue({})
    const client = createMockApiClient(postFn)
    const queue = new OfflineQueue(client)

    queue.enqueue('post', '/api/v1/bug-reports', { title: 'test' })
    await queue.flush()

    expect(postFn).toHaveBeenCalledWith('/api/v1/bug-reports', {
      title: 'test',
    })
    expect(queue.pendingCount).toBe(0)
    queue.destroy()
  })

  it('retries failed requests up to maxRetries', async () => {
    const postFn = jest.fn().mockRejectedValue(new Error('network error'))
    const client = createMockApiClient(postFn)
    const queue = new OfflineQueue(client, 3)

    queue.enqueue('post', '/api/v1/test', { data: 1 })

    // Flush 3 times (maxRetries = 3)
    await queue.flush()
    expect(queue.pendingCount).toBe(1)

    await queue.flush()
    expect(queue.pendingCount).toBe(1)

    await queue.flush()
    expect(queue.pendingCount).toBe(0) // Dropped after 3 retries
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Mite] Dropping queued request to /api/v1/test after 3 retries',
    )

    queue.destroy()
  })

  it('drops a request that meets a plan quota refusal, without a retry', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const postFn = jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 402,
        data: {
          error: 'This account has used all 50 reports in its current billing period.',
          code: 'REPORT_QUOTA_EXCEEDED',
          quota: { limit: 50, used: 50 },
        },
      },
    })
    const client = createMockApiClient(postFn)
    const queue = new OfflineQueue(client, 5)

    queue.enqueue('post', '/api/v1/bug-reports', { title: 'test' })
    await queue.flush()

    // One attempt only, and the entry is gone rather than waiting for four
    // more flush cycles that cannot succeed.
    expect(postFn).toHaveBeenCalledTimes(1)
    expect(queue.pendingCount).toBe(0)

    queue.destroy()
    consoleWarnSpy.mockRestore()
  })

  it('reports a dropped quota refusal to its owner', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const postFn = jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 402,
        data: {
          error: 'This account has used all 50 reports.',
          code: 'REPORT_QUOTA_EXCEEDED',
          quota: { limit: 50, used: 50, resets_at: 1785000000000 },
        },
      },
    })
    const onQuotaRefusal = jest.fn()
    const queue = new OfflineQueue(createMockApiClient(postFn), 5, onQuotaRefusal)

    queue.enqueue('post', '/api/v1/bug-reports', { title: 'test' })
    await queue.flush()

    expect(onQuotaRefusal).toHaveBeenCalledTimes(1)
    expect(onQuotaRefusal).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'REPORT_QUOTA_EXCEEDED',
        quota: { limit: 50, used: 50, resetsAt: 1785000000000 },
      }),
    )

    queue.destroy()
    consoleWarnSpy.mockRestore()
  })

  it('keeps draining when the quota refusal handler throws', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const postFn = jest.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 402,
        data: { code: 'REPORT_QUOTA_EXCEEDED', quota: { limit: 50, used: 50 } },
      },
    })
    const queue = new OfflineQueue(createMockApiClient(postFn), 5, () => {
      throw new Error('handler is broken')
    })

    queue.enqueue('post', '/api/v1/bug-reports', { title: 'test' })
    await expect(queue.flush()).resolves.toBeUndefined()

    expect(queue.pendingCount).toBe(0)

    queue.destroy()
    consoleWarnSpy.mockRestore()
  })

  it('handles put requests', async () => {
    const putFn = jest.fn().mockResolvedValue({})
    const client = createMockApiClient(undefined, putFn)
    const queue = new OfflineQueue(client)

    queue.enqueue('put', '/api/v1/update', { id: '123' })
    await queue.flush()

    expect(putFn).toHaveBeenCalledWith('/api/v1/update', { id: '123' })
    expect(queue.pendingCount).toBe(0)
    queue.destroy()
  })

  it('caps queue size at 100', () => {
    const client = createMockApiClient()
    const queue = new OfflineQueue(client)

    for (let i = 0; i < 110; i++) {
      queue.enqueue('post', `/api/test/${i}`, {})
    }

    expect(queue.pendingCount).toBe(100)
    queue.destroy()
  })

  it('clears queue on destroy', () => {
    const client = createMockApiClient()
    const queue = new OfflineQueue(client)

    queue.enqueue('post', '/api/test', {})
    queue.enqueue('post', '/api/test2', {})
    queue.destroy()

    expect(queue.pendingCount).toBe(0)
  })

  it('does not flush concurrently', async () => {
    let resolvePost: (() => void) | null = null
    const postFn = jest.fn(
      () =>
        new Promise<Record<string, never>>(resolve => {
          resolvePost = () => resolve({})
        }),
    )
    const client = createMockApiClient(postFn)
    const queue = new OfflineQueue(client)

    queue.enqueue('post', '/api/test', {})

    const flush1 = queue.flush()
    const flush2 = queue.flush() // Should be a no-op since flush1 is running

    // Only one post call should have been made
    expect(postFn).toHaveBeenCalledTimes(1)

    resolvePost!()
    await flush1
    await flush2

    queue.destroy()
  })
})
