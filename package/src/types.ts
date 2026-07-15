export interface MiteIdentityStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

/** MMKV-compatible storage interface (react-native-mmkv) */
export interface MiteMMKVLikeStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

export interface MiteConfig {
  apiKey?: string
  endpoint?: string
  timeout?: number
  retries?: number
  /**
   * Override the automatically generated anonymous identifier.
   */
  anonymousId?: string
  /**
   * Persisted identity state storage. Accepts an AsyncStorage-compatible adapter
   * or an MMKV instance directly. Used to keep the anonymous id across app restarts.
   */
  identityStorage?: MiteIdentityStorage | MiteMMKVLikeStorage
  /**
   * Start the SDK in anonymous-only mode. When enabled, Mite will not send
   * user ids, contact fields, metadata, or device info.
   */
  identificationOptOut?: boolean
  /**
   * Enable offline request queuing for failed requests.
   * @default true
   */
  enableOfflineQueue?: boolean
}

export type ReleasePlatform = 'ios' | 'android' | 'all'
export type FeatureRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED'

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

export interface FeatureRequest {
  id: string
  title: string
  description: string
  authorName: string
  voteCount: number
  status: FeatureRequestStatus
  createdAt: number
}

export interface FeatureRequestsResponse {
  requests: FeatureRequest[]
}

export interface CreateFeatureRequestPayload {
  title: string
  description?: string
  /**
   * Optional display name shown next to the request. When omitted, the
   * request is attributed to the SDK's identified/anonymous end user.
   */
  author_name?: string
  /**
   * Optional contact email. The request is always tied to the SDK's
   * identified/anonymous end user, so this is no longer required.
   */
  author_email?: string
  /**
   * Override the anonymous identifier. Defaults to the SDK's current
   * anonymous id.
   */
  anonymous_id?: string
  /**
   * Override the user identifier. Defaults to the SDK's current
   * identified user, when one exists.
   */
  user_identifier?: string
}

export interface CreateFeatureRequestResponse {
  id: string
  status: FeatureRequestStatus
}

export interface VoteFeatureRequestPayload {
  feature_request_id: string
  /**
   * @deprecated Votes are tied to the SDK's identified/anonymous end user.
   * Provide only to keep older email-based votes working.
   */
  voter_email?: string
  /**
   * Override the anonymous identifier. Defaults to the SDK's current
   * anonymous id.
   */
  anonymous_id?: string
  /**
   * Override the user identifier. Defaults to the SDK's current
   * identified user, when one exists.
   */
  user_identifier?: string
}

export interface VoteFeatureRequestResponse {
  voted: boolean
  voteCount: number
}

export interface FeatureRequestVotesResponse {
  featureRequestIds: string[]
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
