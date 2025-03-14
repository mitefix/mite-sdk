import type Device from 'expo-device'

export interface MiteConfig {
  appId: string
  publicKey: string
  endpoint?: string
  timeout?: number
  retries?: number
}

export interface ApiClientConfig {
  appId: string
  publicKey: string
  endpoint?: string
  timeout?: number
  retries?: number
  deviceInfo: typeof Device
}

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
  captureError(error: Error | Record<string, unknown>, additionalInfo?: Record<string, unknown>): Promise<void>
  logError(error: Error, metadata?: Record<string, unknown>): Promise<void>
}
