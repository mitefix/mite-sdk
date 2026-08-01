import { isQuotaRefusal, parseQuotaRefusal } from '../utils/quota'

function quotaError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } }
}

describe('parseQuotaRefusal', () => {
  it('reads a report quota refusal', () => {
    const refusal = parseQuotaRefusal(
      quotaError(402, {
        error: 'This account has used all 50 reports in its current billing period.',
        code: 'REPORT_QUOTA_EXCEEDED',
        quota: { limit: 50, used: 50, resets_at: 1785000000000 },
      }),
    )

    expect(refusal).toEqual({
      code: 'REPORT_QUOTA_EXCEEDED',
      message: 'This account has used all 50 reports in its current billing period.',
      quota: { limit: 50, used: 50, resetsAt: 1785000000000 },
    })
  })

  it('reads a storage quota refusal without a reset time', () => {
    const refusal = parseQuotaRefusal(
      quotaError(402, {
        error: 'This account has used all of its attachment storage.',
        code: 'STORAGE_QUOTA_EXCEEDED',
        quota: { limit: 104857600, used: 104857600 },
      }),
    )

    expect(refusal?.code).toBe('STORAGE_QUOTA_EXCEEDED')
    expect(refusal?.quota).toEqual({ limit: 104857600, used: 104857600 })
    expect(refusal?.quota.resetsAt).toBeUndefined()
  })

  it('ignores a 402 with an unknown code', () => {
    expect(parseQuotaRefusal(quotaError(402, { code: 'SOMETHING_ELSE' }))).toBeNull()
  })

  it('ignores a 402 with no code', () => {
    expect(parseQuotaRefusal(quotaError(402, { error: 'Payment required' }))).toBeNull()
  })

  it('ignores a known code on a status that is not 402', () => {
    expect(
      parseQuotaRefusal(quotaError(429, { code: 'REPORT_QUOTA_EXCEEDED' })),
    ).toBeNull()
  })

  it('ignores errors that carry no response', () => {
    expect(parseQuotaRefusal(new Error('Network Error'))).toBeNull()
    expect(parseQuotaRefusal(null)).toBeNull()
    expect(parseQuotaRefusal(undefined)).toBeNull()
    expect(parseQuotaRefusal('boom')).toBeNull()
  })

  it('falls back to a default message and zeroed counters', () => {
    const refusal = parseQuotaRefusal(quotaError(402, { code: 'STORAGE_QUOTA_EXCEEDED' }))

    expect(refusal?.message).toBe('This account has reached a plan limit.')
    expect(refusal?.quota).toEqual({ limit: 0, used: 0 })
  })
})

describe('isQuotaRefusal', () => {
  it('is true only for a recognised refusal', () => {
    expect(isQuotaRefusal(quotaError(402, { code: 'REPORT_QUOTA_EXCEEDED' }))).toBe(true)
    expect(isQuotaRefusal(quotaError(500, {}))).toBe(false)
  })
})
