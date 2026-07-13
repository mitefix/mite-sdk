export interface MiteConfig {
  /** API key created in the Mite dashboard. Sent as a Bearer token. */
  apiKey: string
  /** Override the Mite API base URL. */
  endpoint?: string
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeout?: number
  /** Retry attempts for failed GET requests. Defaults to 2. */
  maxRetries?: number
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

export interface GetReleasesOptions {
  platform?: ReleasePlatform
  limit?: number
}

export type BugReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface BugReportAttachment {
  /** Local file URI, e.g. from expo-image-picker. */
  uri: string
  fileName?: string
  mimeType?: string
}

export interface BugReportPayload {
  title: string
  description: string
  /** Your app's ID for the reporting user. */
  userIdentifier?: string
  /** Stable identifier for users who are not signed in. */
  anonymousId?: string
  reporterName?: string
  reporterEmail?: string
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  /** Defaults to MEDIUM on the server. */
  priority?: BugReportPriority
  appVersion?: string
  /** Flat string record, e.g. { buildType: 'release', locale: 'en-US' }. */
  environment?: Record<string, string>
  /** Merged over the automatically collected device snapshot. */
  deviceInfo?: Record<string, string>
  attachments?: BugReportAttachment[]
}

export interface BugReportResult {
  id: string
  status: string
}

export interface IdentifyPayload {
  /** Your app's ID for the user. At least one identifier is required. */
  userIdentifier?: string
  /** Stable identifier for users who are not signed in. */
  anonymousId?: string
  email?: string
  name?: string
  appVersion?: string
  /** Merged over the automatically collected device snapshot. */
  deviceInfo?: Record<string, string>
  metadata?: Record<string, string>
}

export interface IdentifyResult {
  id: string
  /** True when a new profile was created, false when updated. */
  created: boolean
}

export type FeatureRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED'

export interface FeatureRequest {
  id: string
  title: string
  description: string
  authorName: string
  voteCount: number
  status: FeatureRequestStatus
  createdAt: number
}

export interface CreateFeatureRequestPayload {
  title: string
  description?: string
  authorName: string
  authorEmail: string
}

export interface CreateFeatureRequestResult {
  id: string
  status: FeatureRequestStatus
}

export interface VoteFeatureRequestPayload {
  featureRequestId: string
  voterEmail: string
}

export interface VoteResult {
  /** True when the vote was added, false when it was removed (toggle). */
  voted: boolean
  voteCount: number
}
