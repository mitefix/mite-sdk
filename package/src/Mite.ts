import * as Device from 'expo-device'
import { BugReporter } from './BugReporter'
import { ErrorHandler } from './ErrorHandler'
import { OfflineQueue } from './OfflineQueue'
import type {
  CapturedError,
  GetReleasesOptions,
  IdentifyUserPayload,
  IdentifyUserResponse,
  MiteConfig,
  Release,
  ReleasesResponse,
  SubmitBugReportPayload,
  SubmitBugReportResponse,
} from './types'
import { ApiClient } from './utils/client'

function getDeviceInfo(): Record<string, unknown> {
  const deviceTypeMap: Record<number, string> = {
    0: 'UNKNOWN',
    1: 'PHONE',
    2: 'TABLET',
    3: 'DESKTOP',
    4: 'TV',
  }

  return {
    brand: Device.brand,
    designName: Device.designName,
    deviceName: Device.deviceName,
    deviceType: deviceTypeMap[Device.deviceType ?? 0] ?? 'UNKNOWN',
    deviceYearClass: Device.deviceYearClass,
    isDevice: Device.isDevice,
    manufacturer: Device.manufacturer,
    modelId: Device.modelId,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    osBuildId: Device.osBuildId,
    osInternalBuildId: Device.osInternalBuildId,
    osBuildFingerprint: Device.osBuildFingerprint,
    platformApiLevel: Device.platformApiLevel,
    productName: Device.productName,
    supportedCpuArchitectures: Device.supportedCpuArchitectures,
    totalMemory: Device.totalMemory,
  }
}

export class Mite {
  private deviceInfo: Record<string, unknown>
  private apiClient: ApiClient
  private bugReporter: BugReporter
  private apiKey?: string
  private config: MiteConfig
  private errorHandler: ErrorHandler | null = null
  private offlineQueue: OfflineQueue | null = null
  private capturedErrors: CapturedError[] = []
  private initialized = false

  constructor(config: MiteConfig) {
    this.config = config
    this.apiKey = config.apiKey
    this.deviceInfo = getDeviceInfo()
    this.apiClient = new ApiClient({
      baseUrl: config.endpoint,
      timeout: config.timeout || 5000,
      maxRetries: config.retries,
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    })
    this.bugReporter = new BugReporter({
      deviceInfo: this.deviceInfo,
      apiClient: this.apiClient,
    })
  }

  /**
   * Initialize the SDK. Sets up JS error tracking and offline queue.
   * Call this once after creating the Mite instance.
   */
  init(): void {
    if (this.initialized) {
      console.warn('[Mite] SDK already initialized')
      return
    }

    const enableErrorTracking = this.config.enableErrorTracking !== false
    const enableOfflineQueue = this.config.enableOfflineQueue !== false

    if (enableErrorTracking) {
      this.errorHandler = new ErrorHandler((error: Error, isFatal: boolean) => {
        this.handleCapturedError(error, isFatal)
      })
      this.errorHandler.install()
      console.log('[Mite] JS error tracking enabled')
    }

    if (enableOfflineQueue) {
      this.offlineQueue = new OfflineQueue(this.apiClient)
      console.log('[Mite] Offline queue enabled')
    }

    this.initialized = true
    console.log('[Mite] SDK initialized')
  }

  /**
   * Tear down the SDK. Removes error handlers and clears queues.
   */
  destroy(): void {
    if (this.errorHandler) {
      this.errorHandler.uninstall()
      this.errorHandler = null
    }

    if (this.offlineQueue) {
      this.offlineQueue.destroy()
      this.offlineQueue = null
    }

    this.capturedErrors = []
    this.initialized = false
  }

  /**
   * Submit a bug report to the server.
   * If the request fails and offline queue is enabled, it will be retried.
   */
  async submitBug(
    payload: Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>,
  ): Promise<SubmitBugReportResponse> {
    try {
      return await this.bugReporter.sendBugReportToServer(payload)
    } catch (err) {
      if (this.offlineQueue && this.isNetworkError(err)) {
        this.offlineQueue.enqueue('post', '/api/v1/bug-reports', {
          device_info: this.deviceInfo,
          ...payload,
        })
        console.log('[Mite] Bug report queued for retry')
      }
      throw err
    }
  }

  /**
   * Identify an end user in your application.
   * At least one of user_identifier or anonymous_id is required.
   */
  async identify(payload: IdentifyUserPayload): Promise<IdentifyUserResponse> {
    if (!this.apiKey) {
      throw new Error(
        '[Mite] API key is required to identify users. Please provide apiKey in MiteConfig.',
      )
    }

    if (!payload.user_identifier && !payload.anonymous_id) {
      throw new Error(
        '[Mite] At least one of user_identifier or anonymous_id is required.',
      )
    }

    return this.apiClient.post<IdentifyUserResponse>('/api/v1/identify', {
      ...payload,
      device_info: payload.device_info ?? this.deviceInfo,
    })
  }

  /**
   * Fetch published releases for the application
   */
  async getReleases(options: GetReleasesOptions = {}): Promise<Release[]> {
    if (!this.apiKey) {
      throw new Error(
        '[Mite] API key is required to fetch releases. Please provide apiKey in MiteConfig.',
      )
    }

    const params = new URLSearchParams()
    if (options.platform) {
      params.append('platform', options.platform)
    }
    if (options.limit) {
      params.append('limit', options.limit.toString())
    }

    const queryString = params.toString()
    const url = `/api/v1/releases${queryString ? `?${queryString}` : ''}`

    const response = await this.apiClient.get<ReleasesResponse>(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    return response.releases
  }

  /**
   * Get all JS errors captured since last retrieval.
   */
  getCapturedErrors(): CapturedError[] {
    return [...this.capturedErrors]
  }

  /**
   * Clear captured errors buffer.
   */
  clearCapturedErrors(): void {
    this.capturedErrors = []
  }

  /**
   * Manually flush the offline queue.
   */
  async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue) {
      await this.offlineQueue.flush()
    }
  }

  /**
   * Get the number of pending requests in the offline queue.
   */
  get pendingRequestCount(): number {
    return this.offlineQueue?.pendingCount ?? 0
  }

  private handleCapturedError(error: Error, isFatal: boolean): void {
    const captured: CapturedError = {
      message: error.message,
      stack: error.stack,
      isFatal,
      timestamp: Date.now(),
    }

    this.capturedErrors.push(captured)

    // Keep buffer bounded
    if (this.capturedErrors.length > 50) {
      this.capturedErrors = this.capturedErrors.slice(-50)
    }

    if (this.config.onError) {
      this.config.onError(error, isFatal)
    }

    console.error(
      `[Mite] Captured ${isFatal ? 'fatal' : 'non-fatal'} error:`,
      error.message,
    )
  }

  private isNetworkError(err: unknown): boolean {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT'
    }
    return false
  }
}
