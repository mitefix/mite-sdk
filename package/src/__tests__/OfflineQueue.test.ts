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
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
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

    queue.destroy()
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
