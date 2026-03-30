export interface MiteConfig {
  apiKey?: string
  endpoint?: string
  timeout?: number
  retries?: number
}

export type ReleasePlatform = 'ios' | 'android' | 'all'

export interface Release {
  id: string
  version: string
  versionCode: number
  platform: ReleasePlatform
  notes?: string
  releasedAt?: number
  createdAt: number
}

export interface ReleasesResponse {
  releases: Release[]
}

export interface GetReleasesOptions {
  platform?: ReleasePlatform
  limit?: number
}

export interface SubmitBugReportPayload {
  title: string
  description: string
  user_identifier?: string
  anonymous_id?: string
  reporter_name?: string
  reporter_email?: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  app_version?: string
  device_info?: Record<string, unknown>
  environment?: Record<string, unknown>
  attachments?: Array<{ uri: string; type?: string; name?: string }>
}

export interface SubmitBugReportResponse {
  id: string
  status: 'OPEN'
}

export interface IdentifyUserPayload {
  user_identifier?: string
  anonymous_id?: string
  email?: string
  name?: string
  device_info?: Record<string, unknown>
  app_version?: string
  metadata?: Record<string, unknown>
}

export interface IdentifyUserResponse {
  id: string
  created: boolean
}
