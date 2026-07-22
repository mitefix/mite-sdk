import { Mite } from '../Mite'
import { navigationTracker, recordNavigationBreadcrumb } from '../NavigationTracker'
import type { MiteIdentityStorage } from '../types'

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      response: { use: jest.fn() },
      request: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  }
  return {
    create: jest.fn(() => mockAxiosInstance),
    __mockInstance: mockAxiosInstance,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios')
const mockAxios = axios.__mockInstance

function createStorage(initialState?: Record<string, string>): MiteIdentityStorage {
  const store = new Map(Object.entries(initialState ?? {}))

  return {
    async getItem(key) {
      return store.get(key) ?? null
    },
    async setItem(key, value) {
      store.set(key, value)
    },
    async removeItem(key) {
      store.delete(key)
    },
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise<void>(resolve => setTimeout(() => resolve(), 0))
}

describe('Mite', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    navigationTracker.configure({ enabled: true })
    navigationTracker.clear()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('constructor', () => {
    it('creates instance with minimal config', () => {
      const mite = new Mite({})
      expect(mite).toBeInstanceOf(Mite)
    })

    it('creates instance with full config', () => {
      const mite = new Mite({
        apiKey: 'test-key',
        endpoint: 'https://example.com',
        timeout: 10000,
        retries: 3,
      })
      expect(mite).toBeInstanceOf(Mite)
    })

    it('stores authorization header in axios defaults when apiKey is provided', () => {
      new Mite({ apiKey: 'test-key' })

      expect(mockAxios.defaults.headers.common).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      )
    })

    it('creates an anonymous id automatically', () => {
      const mite = new Mite({ apiKey: 'test-key' })

      expect(mite.anonymousId).toMatch(/^anon_/)
    })

    it('uses a configured anonymous id override', () => {
      const mite = new Mite({
        apiKey: 'test-key',
        anonymousId: 'anon_custom',
      })

      expect(mite.anonymousId).toBe('anon_custom')
    })

    it('restores the anonymous id from storage', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: '123', created: true } })
      const storage = createStorage({
        '@mite/sdk-identity': JSON.stringify({
          anonymousId: 'anon_persisted',
          identificationOptOut: false,
        }),
      })

      const mite = new Mite({
        apiKey: 'test-key',
        identityStorage: storage,
      })

      await mite.identify({})

      expect(mite.anonymousId).toBe('anon_persisted')
    })
  })

  describe('init', () => {
    it('initializes the SDK', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'anon-user', created: true } })
      const mite = new Mite({ apiKey: 'test' })
      mite.init()
      await flushPromises()

      expect(consoleLogSpy).toHaveBeenCalledWith('[Mite] SDK initialized')
      mite.destroy()
    })

    it('warns on double initialization', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'anon-user', created: true } })
      const mite = new Mite({ apiKey: 'test' })
      mite.init()
      mite.init()
      await flushPromises()

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Mite] SDK already initialized')
      mite.destroy()
    })

    it('respects enableOfflineQueue=false', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'anon-user', created: true } })
      const mite = new Mite({
        apiKey: 'test',
        enableOfflineQueue: false,
      })
      mite.init()
      await flushPromises()

      expect(consoleLogSpy).not.toHaveBeenCalledWith('[Mite] Offline queue enabled')
      mite.destroy()
    })

    it('automatically syncs the current identity on init', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'anon-user', created: true } })
      const mite = new Mite({ apiKey: 'test' })
      mite.init()
      await flushPromises()

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/identify',
        expect.objectContaining({
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )
    })
  })

  describe('destroy', () => {
    it('cleans up resources', () => {
      const mite = new Mite({ apiKey: 'test' })
      mite.init()
      mite.destroy()

      expect(mite.pendingRequestCount).toBe(0)
    })
  })

  describe('identify', () => {
    it('throws without apiKey', async () => {
      const mite = new Mite({})

      await expect(mite.identify({ user_identifier: 'user1' })).rejects.toThrow(
        '[Mite] API key is required',
      )
    })

    it('uses the anonymous id when no identifiers are provided', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: '123', created: true },
      })

      const mite = new Mite({ apiKey: 'test' })

      await expect(mite.identify({})).resolves.toEqual({
        id: '123',
        created: true,
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/identify',
        expect.objectContaining({
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )
    })

    it('sends identify request', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: '123', created: true },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.identify({ user_identifier: 'user1' })

      expect(result).toEqual({ id: '123', created: true })
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/identify',
        expect.objectContaining({
          user_identifier: 'user1',
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )
    })

    it('normalizes default device_info values to strings for identify', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: '123', created: true },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.identify({ user_identifier: 'user1' })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/identify',
        expect.objectContaining({
          user_identifier: 'user1',
          device_info: expect.objectContaining({
            brand: 'TestBrand',
            deviceYearClass: '2024',
            isDevice: 'true',
            platformApiLevel: '34',
            supportedCpuArchitectures: '["arm64"]',
            totalMemory: '8000000000',
          }),
        }),
        undefined,
      )
    })

    it('persists the identified user id for later sessions', async () => {
      const storage = createStorage()
      mockAxios.post.mockResolvedValue({ data: { id: '123', created: true } })

      const mite = new Mite({
        apiKey: 'test',
        identityStorage: storage,
      })
      await mite.identify({ user_identifier: 'user1' })

      const nextMite = new Mite({
        apiKey: 'test',
        identityStorage: storage,
      })
      await nextMite.identify({})

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/identify',
        expect.objectContaining({
          user_identifier: 'user1',
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )
    })
  })

  describe('getReleases', () => {
    it('throws without apiKey', async () => {
      const mite = new Mite({})

      await expect(mite.getReleases()).rejects.toThrow('[Mite] API key is required')
    })

    it('fetches releases', async () => {
      const releases = [{ id: '1', version: '1.0.0', versionCode: 1, platform: 'all' }]
      mockAxios.get.mockResolvedValueOnce({ data: { releases } })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.getReleases({ platform: 'ios', limit: 5 })

      expect(result).toEqual(releases)
    })
  })

  describe('feature requests', () => {
    it('fetches feature requests', async () => {
      const requests = [
        {
          id: 'fr_1',
          title: 'Offline mode',
          description: 'Cache updates locally',
          authorName: 'Test User',
          voteCount: 3,
          status: 'OPEN',
          createdAt: 123,
        },
      ]
      mockAxios.get.mockResolvedValueOnce({ data: { requests } })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.getFeatureRequests()

      expect(result).toEqual(requests)
      expect(mockAxios.get).toHaveBeenCalledWith('/api/v1/feature-requests', undefined)
    })

    it('creates feature requests tied to the anonymous id', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'fr_1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.createFeatureRequest({
        title: ' Offline mode ',
        description: ' Cache updates locally ',
      })

      expect(result).toEqual({ id: 'fr_1', status: 'OPEN' })
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/feature-requests',
        {
          title: 'Offline mode',
          description: 'Cache updates locally',
          anonymous_id: mite.anonymousId,
        },
        undefined,
      )
    })

    it('creates feature requests with normalized optional author fields', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'fr_1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.createFeatureRequest({
        title: ' Offline mode ',
        author_name: ' Test User ',
        author_email: 'USER@EXAMPLE.COM ',
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/feature-requests',
        {
          title: 'Offline mode',
          description: '',
          anonymous_id: mite.anonymousId,
          author_name: 'Test User',
          author_email: 'user@example.com',
        },
        undefined,
      )
    })

    it('includes the identified user id when creating feature requests', async () => {
      mockAxios.post
        .mockResolvedValueOnce({ data: { id: '123', created: true } })
        .mockResolvedValueOnce({ data: { id: 'fr_1', status: 'OPEN' } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.identify({ user_identifier: 'user1' })
      await mite.createFeatureRequest({ title: 'Offline mode' })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/feature-requests',
        {
          title: 'Offline mode',
          description: '',
          anonymous_id: mite.anonymousId,
          user_identifier: 'user1',
        },
        undefined,
      )
    })

    it('omits identified author fields when opted out', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'fr_1', status: 'OPEN' } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.identify({ user_identifier: 'user1' })
      await mite.setIdentificationOptOut(true)
      await mite.createFeatureRequest({
        title: 'Offline mode',
        author_name: 'Test User',
        author_email: 'user@example.com',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/feature-requests',
        {
          title: 'Offline mode',
          description: '',
          anonymous_id: mite.anonymousId,
        },
        undefined,
      )
    })

    it('votes on feature requests tied to the anonymous id', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { voted: true, voteCount: 4 },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.voteFeatureRequest({
        feature_request_id: 'fr_1',
      })

      expect(result).toEqual({ voted: true, voteCount: 4 })
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/feature-requests/vote',
        {
          feature_request_id: 'fr_1',
          anonymous_id: mite.anonymousId,
        },
        undefined,
      )
    })

    it('includes the identified user id when voting', async () => {
      mockAxios.post
        .mockResolvedValueOnce({ data: { id: '123', created: true } })
        .mockResolvedValueOnce({ data: { voted: true, voteCount: 4 } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.identify({ user_identifier: 'user1' })
      await mite.voteFeatureRequest({ feature_request_id: 'fr_1' })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/feature-requests/vote',
        {
          feature_request_id: 'fr_1',
          anonymous_id: mite.anonymousId,
          user_identifier: 'user1',
        },
        undefined,
      )
    })

    it('keeps supporting legacy email-based votes', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { voted: true, voteCount: 4 },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.voteFeatureRequest({
        feature_request_id: 'fr_1',
        voter_email: 'USER@EXAMPLE.COM ',
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/feature-requests/vote',
        {
          feature_request_id: 'fr_1',
          anonymous_id: mite.anonymousId,
          voter_email: 'user@example.com',
        },
        undefined,
      )
    })

    it('fetches voted feature request ids for the current identity', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { featureRequestIds: ['fr_1', 'fr_2'] },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.getFeatureRequestVotes()

      expect(result).toEqual(['fr_1', 'fr_2'])
      expect(mockAxios.get).toHaveBeenCalledWith(
        `/api/v1/feature-requests/votes?anonymous_id=${encodeURIComponent(mite.anonymousId)}`,
        undefined,
      )
    })

    it('fetches voted feature request ids for an email', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { featureRequestIds: ['fr_1', 'fr_2'] },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.getFeatureRequestVotes('USER@EXAMPLE.COM ')

      expect(result).toEqual(['fr_1', 'fr_2'])
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/v1/feature-requests/votes?voter_email=user%40example.com',
        undefined,
      )
    })
  })

  describe('pendingRequestCount', () => {
    it('returns 0 when offline queue is not enabled', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'anon-user', created: true } })
      const mite = new Mite({
        apiKey: 'test',
        enableOfflineQueue: false,
      })
      mite.init()
      await flushPromises()
      expect(mite.pendingRequestCount).toBe(0)
      mite.destroy()
    })
  })

  describe('submitBug', () => {
    it('throws without apiKey', async () => {
      const mite = new Mite({})

      await expect(
        mite.submitBug({
          title: 'Test Bug',
          description: 'A test bug report',
        }),
      ).rejects.toThrow('[Mite] API key is required')
    })

    it('submits a bug report', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(result).toEqual({ id: 'bug-1', status: 'OPEN' })
    })

    it('includes the anonymous id automatically in bug reports', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )
    })

    it('reuses the identified user id for later bug reports', async () => {
      mockAxios.post
        .mockResolvedValueOnce({
          data: { id: '123', created: true },
        })
        .mockResolvedValueOnce({
          data: { id: 'bug-1', status: 'OPEN' },
        })

      const mite = new Mite({ apiKey: 'test' })
      const anonymousId = mite.anonymousId

      await mite.identify({ user_identifier: 'user1' })
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          user_identifier: 'user1',
          anonymous_id: anonymousId,
        }),
        undefined,
      )
    })

    it('keeps the anonymous id after logout but stops sending the user id', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: '123', created: true } })

      const mite = new Mite({ apiKey: 'test' })
      const anonymousId = mite.anonymousId

      await mite.identify({ user_identifier: 'user1' })
      await mite.logout()
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          anonymous_id: anonymousId,
        }),
        undefined,
      )
      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/bug-reports',
        expect.not.objectContaining({
          user_identifier: expect.anything(),
        }),
        undefined,
      )
    })

    it('omits identified fields and device info when opted out', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: '123', created: true } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.identify({ user_identifier: 'user1' })
      await mite.setIdentificationOptOut(true)
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
        reporter_name: 'Test User',
        reporter_email: 'user@example.com',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          anonymous_id: mite.anonymousId,
        }),
        undefined,
      )

      const lastCall = mockAxios.post.mock.calls.at(-1)?.[1]
      expect(lastCall).toEqual(
        expect.not.objectContaining({
          user_identifier: expect.anything(),
          reporter_name: expect.anything(),
          reporter_email: expect.anything(),
          device_info: expect.anything(),
        }),
      )
    })

    it('sends only anonymous identity when opted out', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: '123', created: true } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.setIdentificationOptOut(true)
      await mite.identify({
        user_identifier: 'user1',
        email: 'user@example.com',
        name: 'Test User',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/identify',
        {
          anonymous_id: mite.anonymousId,
        },
        undefined,
      )
    })

    it('attaches the navigation trail to the bug report payload', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      recordNavigationBreadcrumb('Home')
      recordNavigationBreadcrumb('Settings')

      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
        environment: { build_type: 'debug' },
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          environment: { build_type: 'debug' },
          navigation_trail: [
            expect.objectContaining({ screen: 'Home' }),
            expect.objectContaining({ screen: 'Settings' }),
          ],
        }),
        undefined,
      )
    })

    it('attaches the navigation trail when opted out of identification', async () => {
      mockAxios.post.mockResolvedValue({ data: { id: 'bug-1', status: 'OPEN' } })

      const mite = new Mite({ apiKey: 'test' })
      await mite.setIdentificationOptOut(true)
      recordNavigationBreadcrumb('Home')

      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(mockAxios.post).toHaveBeenLastCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          navigation_trail: [expect.objectContaining({ screen: 'Home' })],
        }),
        undefined,
      )
    })

    it('omits the navigation trail when no breadcrumbs were recorded', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      const lastCall = mockAxios.post.mock.calls.at(-1)?.[1]
      expect(lastCall).toEqual(
        expect.not.objectContaining({
          navigation_trail: expect.anything(),
        }),
      )
    })

    it('does not record breadcrumbs when enableNavigationBreadcrumbs=false', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({
        apiKey: 'test',
        enableNavigationBreadcrumbs: false,
      })
      recordNavigationBreadcrumb('Home')

      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      const lastCall = mockAxios.post.mock.calls.at(-1)?.[1]
      expect(lastCall).toEqual(
        expect.not.objectContaining({
          navigation_trail: expect.anything(),
        }),
      )
    })

    it('caps the navigation trail with maxNavigationBreadcrumbs', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({
        apiKey: 'test',
        maxNavigationBreadcrumbs: 2,
      })
      recordNavigationBreadcrumb('Home')
      recordNavigationBreadcrumb('Settings')
      recordNavigationBreadcrumb('Profile')

      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          navigation_trail: [
            expect.objectContaining({ screen: 'Settings' }),
            expect.objectContaining({ screen: 'Profile' }),
          ],
        }),
        undefined,
      )
    })

    it('strips triage fields from the bug report payload', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'NEEDS_TRIAGE' },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
        priority: 'CRITICAL',
        status: 'RESOLVED',
        assigned_to: 'user_1',
        assignee: 'user_1',
      } as never)

      const lastCall = mockAxios.post.mock.calls.at(-1)?.[1]
      expect(lastCall).toEqual(
        expect.not.objectContaining({ priority: expect.anything() }),
      )
      expect(lastCall).toEqual(expect.not.objectContaining({ status: expect.anything() }))
      expect(lastCall).toEqual(
        expect.not.objectContaining({ assigned_to: expect.anything() }),
      )
      expect(lastCall).toEqual(
        expect.not.objectContaining({ assignee: expect.anything() }),
      )
    })

    it('normalizes custom device_info values to flat string values for bug reports', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: 'bug-1', status: 'OPEN' },
      })

      const mite = new Mite({ apiKey: 'test' })
      await mite.submitBug({
        title: 'Test Bug',
        description: 'A test bug report',
        device_info: {
          build: 42,
          isTablet: false,
          supported: ['arm64', 'x64'],
          nested: { model: 'test' },
          empty: undefined,
        },
      })

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/v1/bug-reports',
        expect.objectContaining({
          title: 'Test Bug',
          description: 'A test bug report',
          device_info: {
            build: '42',
            isTablet: 'false',
            supported: '["arm64","x64"]',
            nested: '{"model":"test"}',
          },
        }),
        undefined,
      )
    })
  })
})
