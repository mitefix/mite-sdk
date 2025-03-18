import type Device from 'expo-device'
import type { ApiClient } from './utils/client'

export interface MiteConfig {
  appId: string
  publicKey: string
  endpoint?: string
  timeout?: number
  retries?: number
}

export interface ErrorReportConfig {
  miteConfig: MiteConfig
  deviceInfo: typeof Device
  apiClient: ApiClient
}

// export interface ApiClientConfig {
//   appId: string
//   publicKey: string
//   endpoint?: string
//   timeout?: number
//   retries?: number
//   deviceInfo: typeof Device
// }

export interface ErrorReport {
  timestamp: string
  error: {
    error_name: string
    error_message: string
    error_stack: string
    type?: string
    promiseId?: string
  }
  device: typeof Device
  metadata: Record<string, string | number | boolean>
}

export interface Reporter {
  init(): void
  isEnabled(): boolean
  enable(): void
  disable(): void
}

export interface ErrorReporterInterface extends Reporter {
  captureError(
    error: Error | Record<string, unknown>,
    additionalInfo?: Record<string, unknown>,
  ): Promise<void>
  logError(error: Error, metadata?: Record<string, unknown>): Promise<void>
}

export interface SubmitBugReportPayload {
  title: string
  description: string
  userIdentifier?: string // App's user ID
  reporterName?: string // Name of person reporting the bug
  reporterEmail?: string // Email of person reporting the bug
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  priority?: 'low' | 'medium' | 'high' // Defaults to 'medium'
  appVersion?: string // Version of the app
  deviceInfo?: {
    // Device information as JSON
    os?: string
    osVersion?: string
    device?: string
    manufacturer?: string
    model?: string
    screenWidth?: number
    screenHeight?: number
    batteryLevel?: number
    isCharging?: boolean
    connectivity?: string // wifi, cellular, etc.
    [key: string]: unknown // Allow for custom device info
  }

  // Environment information as JSON
  // environment?: {
  //   buildType?: 'debug' | 'release' | 'beta'
  //   locale?: string
  //   timezone?: string
  //   userAgent?: string
  //   [key: string]: any // Allow for custom environment info
  // }
}
