import { useCallback, useState } from 'react'
import { useMite } from './MiteProvider'
import type {
  MiteQuotaRefusal,
  SubmitBugReportPayload,
  SubmitBugReportResponse,
  SubmitBugResult,
} from './types'

export type BugReportPayload = Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>

export interface UseBugReportResult {
  submitBug: (payload: BugReportPayload) => Promise<SubmitBugResult>
  submitting: boolean
  error: Error | null
  lastResponse: SubmitBugReportResponse | null
  /**
   * Set when the account is over a plan limit. A refusal is not a fault, so
   * `error` stays null and `submitBug` does not throw. When `lastResponse` is
   * also set, the report went out but its attachments did not.
   */
  refusal: MiteQuotaRefusal | null
  reset: () => void
}

export function useBugReport(): UseBugReportResult {
  const mite = useMite()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastResponse, setLastResponse] = useState<SubmitBugReportResponse | null>(null)
  const [refusal, setRefusal] = useState<MiteQuotaRefusal | null>(null)

  const submitBug = useCallback(
    async (payload: BugReportPayload) => {
      setSubmitting(true)
      setError(null)
      setRefusal(null)

      try {
        const result = await mite.submitBug(payload)

        if (result.ok) {
          setLastResponse(result.report)
          if (result.droppedAttachments) {
            setRefusal(result.droppedAttachments.refusal)
          }
        } else {
          setRefusal(result.refusal)
        }

        return result
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to submit bug report')
        setError(error)
        throw error
      } finally {
        setSubmitting(false)
      }
    },
    [mite],
  )

  const reset = useCallback(() => {
    setError(null)
    setLastResponse(null)
    setRefusal(null)
  }, [])

  return {
    submitBug,
    submitting,
    error,
    lastResponse,
    refusal,
    reset,
  }
}
