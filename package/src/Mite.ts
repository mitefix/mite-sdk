import { getDeviceInfo } from './device'
import { MiteError } from './errors'
import { HttpClient } from './http'
import type {
  BugReportAttachment,
  BugReportPayload,
  BugReportResult,
  CreateFeatureRequestPayload,
  CreateFeatureRequestResult,
  FeatureRequest,
  GetReleasesOptions,
  IdentifyPayload,
  IdentifyResult,
  MiteConfig,
  Release,
  VoteFeatureRequestPayload,
  VoteResult,
} from './types'

const DEFAULT_ENDPOINT = 'https://intent-okapi-412.convex.site'

interface UploadedAttachment {
  storage_id: string
  file_type?: string
  file_name?: string
}

export class Mite {
  private http: HttpClient

  constructor(config: MiteConfig) {
    if (!config.apiKey) {
      throw new MiteError('[Mite] apiKey is required. Create one in the Mite dashboard.')
    }
    this.http = new HttpClient({
      baseUrl: config.endpoint ?? DEFAULT_ENDPOINT,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 10000,
      maxRetries: config.maxRetries ?? 2,
    })
  }

  /**
   * Submit a bug report. Device info is collected automatically and can be
   * extended or overridden via `payload.deviceInfo`. Attachments are uploaded
   * before the report is created.
   * @throws {MiteError} when validation, auth, or the network fails
   */
  async submitBug(payload: BugReportPayload): Promise<BugReportResult> {
    const attachments = payload.attachments?.length
      ? await this.uploadAttachments(payload.attachments)
      : undefined

    return this.http.post<BugReportResult>('/api/v1/bug-reports', {
      title: payload.title,
      description: payload.description,
      user_identifier: payload.userIdentifier,
      anonymous_id: payload.anonymousId,
      reporter_name: payload.reporterName,
      reporter_email: payload.reporterEmail,
      steps_to_reproduce: payload.stepsToReproduce,
      expected_behavior: payload.expectedBehavior,
      actual_behavior: payload.actualBehavior,
      priority: payload.priority,
      app_version: payload.appVersion,
      environment: payload.environment,
      device_info: { ...getDeviceInfo(), ...payload.deviceInfo },
      attachments,
    })
  }

  /**
   * Create or update the profile of the current end user so reports and
   * feedback can be tied to them.
   * @throws {MiteError} when no identifier is provided or the request fails
   */
  async identify(payload: IdentifyPayload): Promise<IdentifyResult> {
    if (!payload.userIdentifier && !payload.anonymousId) {
      throw new MiteError(
        '[Mite] identify requires at least one of userIdentifier or anonymousId.',
      )
    }
    return this.http.post<IdentifyResult>('/api/v1/identify', {
      user_identifier: payload.userIdentifier,
      anonymous_id: payload.anonymousId,
      email: payload.email,
      name: payload.name,
      app_version: payload.appVersion,
      device_info: { ...getDeviceInfo(), ...payload.deviceInfo },
      metadata: payload.metadata,
    })
  }

  /**
   * Fetch published releases for the application.
   * @throws {MiteError} when the request fails
   */
  async getReleases(options: GetReleasesOptions = {}): Promise<Release[]> {
    const response = await this.http.get<{ releases: Release[] }>('/api/v1/releases', {
      query: { platform: options.platform, limit: options.limit },
    })
    return response.releases
  }

  /**
   * Fetch feature requests, sorted by vote count.
   * @throws {MiteError} when the request fails
   */
  async getFeatureRequests(): Promise<FeatureRequest[]> {
    const response = await this.http.get<{ requests: FeatureRequest[] }>(
      '/api/v1/feature-requests',
    )
    return response.requests
  }

  /**
   * Create a feature request on behalf of an end user.
   * @throws {MiteError} when validation or the request fails
   */
  async createFeatureRequest(
    payload: CreateFeatureRequestPayload,
  ): Promise<CreateFeatureRequestResult> {
    return this.http.post<CreateFeatureRequestResult>('/api/v1/feature-requests', {
      title: payload.title,
      description: payload.description,
      author_name: payload.authorName,
      author_email: payload.authorEmail,
    })
  }

  /**
   * Toggle a vote on a feature request for the given voter.
   * @throws {MiteError} when the request fails
   */
  async voteFeatureRequest(payload: VoteFeatureRequestPayload): Promise<VoteResult> {
    return this.http.post<VoteResult>('/api/v1/feature-requests/vote', {
      feature_request_id: payload.featureRequestId,
      voter_email: payload.voterEmail,
    })
  }

  /**
   * Fetch the ids of feature requests the given voter has voted for.
   * @throws {MiteError} when the request fails
   */
  async getVotedFeatureRequestIds(voterEmail: string): Promise<string[]> {
    const response = await this.http.get<{ featureRequestIds: string[] }>(
      '/api/v1/feature-requests/votes',
      { query: { voter_email: voterEmail } },
    )
    return response.featureRequestIds
  }

  private async uploadAttachments(
    attachments: BugReportAttachment[],
  ): Promise<UploadedAttachment[]> {
    return Promise.all(
      attachments.map(async attachment => {
        const { uploadUrl } = await this.http.post<{ uploadUrl: string }>(
          '/api/v1/upload-url',
        )

        const file = await fetch(attachment.uri)
        const blob = await file.blob()
        const fileType = attachment.mimeType || blob.type || 'application/octet-stream'

        const upload = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': fileType },
          body: blob,
        })
        if (!upload.ok) {
          throw new MiteError(
            `[Mite] Failed to upload attachment (status ${upload.status})`,
            { status: upload.status },
          )
        }

        const { storageId } = (await upload.json()) as { storageId: string }
        return {
          storage_id: storageId,
          file_type: fileType,
          file_name: attachment.fileName,
        }
      }),
    )
  }
}
