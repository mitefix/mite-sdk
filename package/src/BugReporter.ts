import type Device from 'expo-device'
import type { SubmitBugReportPayload } from './types'
import type { ApiClient } from './utils/client'

interface BugReporterConfig {
  appId: string
  apiClient: ApiClient
  deviceInfo: typeof Device
}

export class BugReporter {
  private appId: string
  private apiClient: ApiClient
  private initialized = false
  private enabled = false
  private deviceInfo: typeof Device

  constructor(config: BugReporterConfig) {
    const { appId, apiClient, deviceInfo } = config
    this.appId = appId
    this.apiClient = apiClient
    this.deviceInfo = deviceInfo
  }

  init() {
    if (this.initialized) {
      return
    }
    this.initialized = true
    this.enabled = true
  }

  async sendBugReportToServer(
    payload: Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>,
  ): Promise<void> {
    if (!this.enabled || !this.initialized) return

    try {
      await this.apiClient.post('/report-bug', {
        appId: this.appId,
        deviceInfo: this.deviceInfo,
        ...payload,
      })
    } catch (error) {
      console.error('Failed to send bug report:', error)
    }
  }
}
