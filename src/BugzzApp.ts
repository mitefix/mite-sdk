import * as Device from 'expo-device';

export interface BugzzAppConfig {
  apiKey: string
  appId: string
}

export class BugzzApp {
  apiKey: string
  appId: string
  config: BugzzAppConfig
  enabled: boolean
  deviceInfo: typeof Device
  initialized: boolean

  constructor(config: BugzzAppConfig) {
    this.config = config
    this.apiKey = config.apiKey
    this.appId = config.appId
    this.enabled = false
    this.initialized = false
    this.deviceInfo = Device
  }

  async init() {
    if (this.initialized) {
      return
    }

    this.enabled = true
    this.initialized = true
  }

  setupErrorHandler() {
    if (RNErrorUtils) {
      const originalHandler = RNErrorUtils.getGlobalHandler();

      RNErrorUtils.setGlobalHandler(async (error, isFatal) => {
        // await this.captureError(error, { isFatal });
        originalHandler(error, isFatal);
      });
    }
  }
}
