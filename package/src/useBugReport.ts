import { useCallback, useState } from 'react'
import { useMite } from './MiteProvider'
import type { SubmitBugReportPayload, SubmitBugReportResponse } from './types'

export type BugReportPayload = Omit<SubmitBugReportPayload, 'appId' | 'deviceInfo'>

export interface UseBugReportResult {
  submitBug: (payload: BugReportPayload) => Promise<SubmitBugReportResponse>
  submitting: boolean
  error: Error | null
  lastResponse: SubmitBugReportResponse | null
  reset: () => void
}

export function useBugReport(): UseBugReportResult {
  const mite = useMite()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastResponse, setLastResponse] = useState<SubmitBugReportResponse | null>(null)

  const submitBug = useCallback(
    async (payload: BugReportPayload) => {
      setSubmitting(true)
      setError(null)

      try {
        const response = await mite.submitBug(payload)
        setLastResponse(response)
        return response
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
  }, [])

  return {
    submitBug,
    submitting,
    error,
    lastResponse,
    reset,
  }
}
