import * as Device from 'expo-device'
import { BugReporter } from './BugReporter'
import { OfflineQueue } from './OfflineQueue'
import type {
  GetReleasesOptions,
  IdentifyUserPayload,
  IdentifyUserResponse,
  MiteConfig,
  MiteIdentityStorage,
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
import { generateAnonymousId } from './utils/identity'
import { resolveIdentityStorage } from './utils/storage'

const IDENTITY_STORAGE_KEY = '@mite/sdk-identity'

interface PersistedIdentityState {
  anonymousId: string
  userIdentifier?: string
  identificationOptOut: boolean
}

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
  private identityStorage: MiteIdentityStorage
  private hasPersistentIdentityStorage: boolean
  private identityReady: Promise<void>
  private currentAnonymousId: string
  private currentUserIdentifier?: string
  private identificationOptOut: boolean

  constructor(config: MiteConfig) {
    this.config = config
    this.apiKey = config.apiKey
    this.currentAnonymousId = config.anonymousId ?? generateAnonymousId()
    this.identificationOptOut = config.identificationOptOut ?? false
    const identityStorage = resolveIdentityStorage(config.identityStorage)
    this.identityStorage = identityStorage.storage
    this.hasPersistentIdentityStorage = identityStorage.isPersistent
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
    this.identityReady = this.hydrateIdentityState()
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
    if (!this.hasPersistentIdentityStorage) {
      console.warn(
        '[Mite] No persistent identity storage configured. Anonymous IDs will reset on full app reload. Pass identityStorage (for example AsyncStorage) to persist users across launches.',
      )
    }
    void this.syncIdentityState().catch(() => {
      // Ignore startup identity failures. Later identify calls and bug reports
      // will continue to use the latest local identity state.
    })
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
    await this.ensureIdentityReady()
    const payloadWithIdentity = this.buildBugReportPayload(payload)

    try {
      return await this.bugReporter.sendBugReportToServer(payloadWithIdentity, {
        includeDefaultDeviceInfo: !this.identificationOptOut,
      })
    } catch (err) {
      if (this.offlineQueue && this.isNetworkError(err)) {
        const queuedPayload: Record<string, unknown> = {
          ...payloadWithIdentity,
        }

        if (!this.identificationOptOut) {
          queuedPayload.device_info = normalizeDeviceInfo(
            payloadWithIdentity.device_info ?? this.deviceInfo,
          )
        }

        this.offlineQueue.enqueue('post', '/api/v1/bug-reports', {
          ...queuedPayload,
        })
        console.log('[Mite] Bug report queued for retry')
      }
      throw err
    }
  }

  /**
   * Identify an end user in your application.
   * Uses the current anonymous identifier automatically when needed.
   */
  async identify(payload: IdentifyUserPayload): Promise<IdentifyUserResponse> {
    this.requireApiKey('identify users')
    await this.ensureIdentityReady()
    const payloadWithIdentity = this.buildIdentifyPayload(payload)

    const response = await this.apiClient.post<IdentifyUserResponse>('/api/v1/identify', {
      ...payloadWithIdentity,
    })

    this.currentAnonymousId = payloadWithIdentity.anonymous_id
    if (this.identificationOptOut) {
      this.currentUserIdentifier = undefined
    } else {
      this.currentUserIdentifier = payloadWithIdentity.user_identifier
    }
    await this.persistIdentityState()

    return response
  }

  /**
   * Remove the identified user while keeping the anonymous id stable.
   */
  async logout(): Promise<void> {
    await this.ensureIdentityReady()
    this.currentUserIdentifier = undefined
    await this.persistIdentityState()
    void this.syncIdentityState().catch(() => {
      // Ignore logout sync failures. Local state has already been updated.
    })
  }

  /**
   * Toggle whether identified data should be sent to Mite.
   */
  async setIdentificationOptOut(optedOut: boolean): Promise<void> {
    await this.ensureIdentityReady()
    this.identificationOptOut = optedOut

    if (optedOut) {
      this.currentUserIdentifier = undefined
    }

    await this.persistIdentityState()
    void this.syncIdentityState().catch(() => {
      // Ignore preference sync failures. Local privacy state is already applied.
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

  get anonymousId(): string {
    return this.currentAnonymousId
  }

  get isIdentificationOptedOut(): boolean {
    return this.identificationOptOut
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

  private async hydrateIdentityState(): Promise<void> {
    try {
      const storedState = await this.identityStorage.getItem(IDENTITY_STORAGE_KEY)
      if (storedState) {
        const parsed = JSON.parse(storedState) as Partial<PersistedIdentityState>

        if (!this.config.anonymousId && parsed.anonymousId) {
          this.currentAnonymousId = parsed.anonymousId
        }

        if (typeof parsed.identificationOptOut === 'boolean'
          && this.config.identificationOptOut === undefined) {
          this.identificationOptOut = parsed.identificationOptOut
        }

        if (parsed.userIdentifier) {
          this.currentUserIdentifier = parsed.userIdentifier
        }
      }
    } catch {
      // Ignore storage hydration errors and continue with in-memory state.
    }

    await this.persistIdentityState()
  }

  private async persistIdentityState(): Promise<void> {
    const state: PersistedIdentityState = {
      anonymousId: this.currentAnonymousId,
      identificationOptOut: this.identificationOptOut,
      ...(this.identificationOptOut || !this.currentUserIdentifier
        ? {}
        : { userIdentifier: this.currentUserIdentifier }),
    }

    await this.identityStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(state))
  }

  private async ensureIdentityReady(): Promise<void> {
    await this.identityReady
  }

  private buildIdentifyPayload(
    payload: IdentifyUserPayload,
  ): IdentifyUserPayload & { anonymous_id: string } {
    const anonymous_id = payload.anonymous_id ?? this.currentAnonymousId

    if (this.identificationOptOut) {
      return { anonymous_id }
    }

    const user_identifier = payload.user_identifier ?? this.currentUserIdentifier

    return {
      anonymous_id,
      ...(user_identifier ? { user_identifier } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.app_version ? { app_version: payload.app_version } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
      device_info: normalizeDeviceInfo(payload.device_info ?? this.deviceInfo),
    }
  }

  private buildBugReportPayload(
    payload: Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>,
  ): Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'> {
    const {
      anonymous_id: providedAnonymousId,
      user_identifier: providedUserIdentifier,
      reporter_name: _reporterName,
      reporter_email: _reporterEmail,
      device_info: _deviceInfo,
      ...rest
    } = payload
    const anonymous_id = providedAnonymousId ?? this.currentAnonymousId

    if (this.identificationOptOut) {
      return {
        ...rest,
        anonymous_id,
      }
    }

    const user_identifier = providedUserIdentifier ?? this.currentUserIdentifier

    return {
      ...rest,
      anonymous_id,
      ...(user_identifier ? { user_identifier } : {}),
      ...(_reporterName ? { reporter_name: _reporterName } : {}),
      ...(_reporterEmail ? { reporter_email: _reporterEmail } : {}),
      ...(_deviceInfo ? { device_info: _deviceInfo } : {}),
    }
  }

  private async syncIdentityState(): Promise<void> {
    if (!this.apiKey) {
      return
    }

    await this.ensureIdentityReady()
    const payload = this.buildIdentifyPayload({})

    await this.apiClient.post<IdentifyUserResponse>('/api/v1/identify', payload)
  }
}
