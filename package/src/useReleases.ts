import { useCallback, useEffect, useState } from 'react'
import { useMite } from './MiteProvider'
import type { GetReleasesOptions, Release } from './types'

export interface UseReleasesOptions extends GetReleasesOptions {
  /** Set to false to defer fetching until refetch() is called. Defaults to true. */
  enabled?: boolean
}

export interface UseReleasesResult {
  releases: Release[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useReleases(options: UseReleasesOptions = {}): UseReleasesResult {
  const { enabled = true, platform, limit } = options
  const mite = useMite()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await mite.getReleases({ platform, limit })
      setReleases(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch releases'))
    } finally {
      setLoading(false)
    }
  }, [mite, platform, limit])

  useEffect(() => {
    if (enabled) {
      fetchReleases()
    }
  }, [enabled, fetchReleases])

  return {
    releases,
    loading,
    error,
    refetch: fetchReleases,
  }
}
