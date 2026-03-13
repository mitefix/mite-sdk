import * as Device from 'expo-device'
import { BugReporter } from './BugReporter'
import type {
  GetReleasesOptions,
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

  constructor(config: MiteConfig) {
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
   * Submit a bug report to the server
   */
  async submitBug(
    payload: Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>,
  ): Promise<SubmitBugReportResponse> {
    return this.bugReporter.sendBugReportToServer(payload)
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
}
