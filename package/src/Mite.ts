import * as Device from 'expo-device'
import { BugReporter } from './BugReporter'
import { OfflineQueue } from './OfflineQueue'
import type {
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
import {
  normalizeDeviceInfo,
  type FlatStringRecord,
} from './utils/deviceInfo'

function getDeviceInfo(): FlatStringRecord {
  const deviceTypeMap: Record<number, string> = {
    0: 'UNKNOWN',
    1: 'PHONE',
    2: 'TABLET',
    3: 'DESKTOP',
    4: 'TV',
  }

  return normalizeDeviceInfo({
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
  })
}

export class Mite {
  private deviceInfo: FlatStringRecord
  private apiClient: ApiClient
  private bugReporter: BugReporter
  private apiKey?: string
  private config: MiteConfig
  private offlineQueue: OfflineQueue | null = null
  private initialized = false

  constructor(config: MiteConfig) {
    this.config = config
    this.apiKey = config.apiKey
    this.deviceInfo = getDeviceInfo()
    this.apiClient = new ApiClient({
      baseUrl: config.endpoint,
      timeout: config.timeout || 5000,
      maxRetries: config.retries,
    })

    if (this.apiKey) {
      this.apiClient.updateHeaders({
        Authorization: `Bearer ${this.apiKey}`,
      })
    }

    this.bugReporter = new BugReporter({
      deviceInfo: this.deviceInfo,
      apiClient: this.apiClient,
    })
  }

  /**
   * Initialize the SDK. Sets up offline queue.
   * Call this once after creating the Mite instance.
   */
  init(): void {
    if (this.initialized) {
      console.warn('[Mite] SDK already initialized')
      return
    }

    const enableOfflineQueue = this.config.enableOfflineQueue !== false

    if (enableOfflineQueue) {
      this.offlineQueue = new OfflineQueue(this.apiClient)
      console.log('[Mite] Offline queue enabled')
    }

    this.initialized = true
    console.log('[Mite] SDK initialized')
  }

  /**
   * Tear down the SDK. Clears queues.
   */
  destroy(): void {
    if (this.offlineQueue) {
      this.offlineQueue.destroy()
      this.offlineQueue = null
    }

    this.initialized = false
  }

  /**
   * Submit a bug report to the server.
   * If the request fails and offline queue is enabled, it will be retried.
   */
  async submitBug(
    payload: Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>,
  ): Promise<SubmitBugReportResponse> {
    this.requireApiKey('submit bug reports')

    try {
      return await this.bugReporter.sendBugReportToServer(payload)
    } catch (err) {
      if (this.offlineQueue && this.isNetworkError(err)) {
        this.offlineQueue.enqueue('post', '/api/v1/bug-reports', {
          ...payload,
          device_info: normalizeDeviceInfo(payload.device_info ?? this.deviceInfo),
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
    this.requireApiKey('identify users')

    if (!payload.user_identifier && !payload.anonymous_id) {
      throw new Error(
        '[Mite] At least one of user_identifier or anonymous_id is required.',
      )
    }

    return this.apiClient.post<IdentifyUserResponse>('/api/v1/identify', {
      ...payload,
      device_info: normalizeDeviceInfo(payload.device_info ?? this.deviceInfo),
    })
  }

  /**
   * Fetch published releases for the application
   */
  async getReleases(options: GetReleasesOptions = {}): Promise<Release[]> {
    const apiKey = this.requireApiKey('fetch releases')

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
        Authorization: `Bearer ${apiKey}`,
      },
    })

    return response.releases
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

  private isNetworkError(err: unknown): boolean {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT'
    }
    return false
  }

  private requireApiKey(action: string): string {
    const apiKey = this.apiKey

    if (!apiKey) {
      throw new Error(
        `[Mite] API key is required to ${action}. Please provide apiKey in MiteConfig.`,
      )
    }

    return apiKey
  }
}
