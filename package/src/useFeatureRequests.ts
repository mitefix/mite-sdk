import { useCallback, useEffect, useState } from 'react'
import { useMite } from './MiteProvider'
import type { FeatureRequest } from './types'

export interface UseFeatureRequestsOptions {
  enabled?: boolean
  voterEmail?: string
}

export interface UseFeatureRequestsResult {
  featureRequests: FeatureRequest[]
  votedFeatureRequestIds: string[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useFeatureRequests(
  options: UseFeatureRequestsOptions = {},
): UseFeatureRequestsResult {
  const mite = useMite()
  const { enabled = false, voterEmail } = options
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([])
  const [votedFeatureRequestIds, setVotedFeatureRequestIds] = useState<string[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)

  const fetchFeatureRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [requests, votedIds] = await Promise.all([
        mite.getFeatureRequests(),
        voterEmail
          ? mite.getFeatureRequestVotes(voterEmail)
          : Promise.resolve<string[]>([]),
      ])

      setFeatureRequests(requests)
      setVotedFeatureRequestIds(votedIds)
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to fetch feature requests')
      setError(error)
      console.error('[Mite] useFeatureRequests error:', error)
    } finally {
      setLoading(false)
    }
  }, [mite, voterEmail])

  useEffect(() => {
    if (enabled) {
      void fetchFeatureRequests()
    }
  }, [enabled, fetchFeatureRequests])

  return {
    featureRequests,
    votedFeatureRequestIds,
    loading,
    error,
    refetch: fetchFeatureRequests,
  }
}
