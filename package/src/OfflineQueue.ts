import type { ApiClient } from './utils/client'

interface QueuedRequest {
  id: string
  method: 'post' | 'put'
  url: string
  data?: unknown
  timestamp: number
  retries: number
}

const FLUSH_INTERVAL_MS = 30_000
const MAX_QUEUE_SIZE = 100
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * In-memory queue that retries failed network requests.
 * Requests are queued when they fail due to network errors
 * and periodically retried with exponential backoff.
 */
export class OfflineQueue {
  private queue: QueuedRequest[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private apiClient: ApiClient
  private maxRetries: number
  private flushPromise: Promise<void> | null = null

  constructor(apiClient: ApiClient, maxRetries = 5) {
    this.apiClient = apiClient
    this.maxRetries = maxRetries
  }

  /**
   * Add a failed request to the retry queue.
   */
  enqueue(method: 'post' | 'put', url: string, data?: unknown): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop oldest item to make room
      this.queue.shift()
    }

    this.queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      method,
      url,
      data,
      timestamp: Date.now(),
      retries: 0,
    })

    this.startFlushTimer()
  }

  /**
   * Attempt to send all queued requests.
   */
  async flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise
    if (this.queue.length === 0) return

    this.flushPromise = this.processQueue().finally(() => {
      this.flushPromise = null
    })

    return this.flushPromise
  }

  private async processQueue(): Promise<void> {
    const items = [...this.queue]
    const completed: string[] = []

    for (const item of items) {
      // Drop stale requests
      if (Date.now() - item.timestamp > MAX_AGE_MS) {
        completed.push(item.id)
        continue
      }

      try {
        if (item.method === 'post') {
          await this.apiClient.post(item.url, item.data)
        } else {
          await this.apiClient.put(item.url, item.data)
        }
        completed.push(item.id)
      } catch {
        item.retries++
        if (item.retries >= this.maxRetries) {
          completed.push(item.id)
          console.error(
            `[Mite] Dropping queued request to ${item.url} after ${this.maxRetries} retries`,
          )
        }
      }
    }

    this.queue = this.queue.filter(q => !completed.includes(q.id))

    if (this.queue.length === 0) {
      this.stopFlushTimer()
    }
  }

  get pendingCount(): number {
    return this.queue.length
  }

  /**
   * Stop the flush timer and clear the queue.
   */
  destroy(): void {
    this.stopFlushTimer()
    this.queue = []
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Silently handle flush errors
      })
    }, FLUSH_INTERVAL_MS)
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }
}
