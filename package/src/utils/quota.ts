import type { MiteQuota, MiteQuotaCode, MiteQuotaRefusal } from '../types'

const QUOTA_CODES: MiteQuotaCode[] = ['REPORT_QUOTA_EXCEEDED', 'STORAGE_QUOTA_EXCEEDED']

const DEFAULT_MESSAGE = 'This account has reached a plan limit.'

interface QuotaErrorBody {
  error?: string
  code?: string
  quota?: {
    limit?: number
    used?: number
    resets_at?: number
  }
}

/**
 * Turn a failed request into a plan quota refusal, when that is what it is.
 *
 * The server answers a quota refusal with HTTP 402 and one of the codes in
 * {@link MiteQuotaCode}. It never answers with 429, because a retry cannot
 * change the result. Anything else returns `null` and stays an ordinary error.
 *
 * This is the only place in the SDK that reads the refusal wire format.
 */
export function parseQuotaRefusal(err: unknown): MiteQuotaRefusal | null {
  const response = (err as { response?: { status?: number; data?: unknown } } | null)
    ?.response

  if (!response || response.status !== 402) {
    return null
  }

  const body = response.data as QuotaErrorBody | undefined
  const code = body?.code

  if (!code || !QUOTA_CODES.includes(code as MiteQuotaCode)) {
    return null
  }

  const quota: MiteQuota = {
    limit: body?.quota?.limit ?? 0,
    used: body?.quota?.used ?? 0,
  }

  // Only the report code carries a reset time. Storage is a standing total.
  if (typeof body?.quota?.resets_at === 'number') {
    quota.resetsAt = body.quota.resets_at
  }

  return {
    code: code as MiteQuotaCode,
    message: body?.error ?? DEFAULT_MESSAGE,
    quota,
  }
}

/**
 * True when the error is a plan quota refusal. Use it where the caller must
 * recognise a refusal but does not act on its contents, such as the retry
 * guards.
 */
export function isQuotaRefusal(err: unknown): boolean {
  return parseQuotaRefusal(err) !== null
}
