import { Mite } from '../Mite'

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

describe('Mite', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
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
  })

  describe('init', () => {
    it('initializes the SDK', () => {
      const mite = new Mite({ apiKey: 'test' })
      mite.init()

      expect(consoleLogSpy).toHaveBeenCalledWith('[Mite] SDK initialized')
      mite.destroy()
    })

    it('warns on double initialization', () => {
      const mite = new Mite({ apiKey: 'test' })
      mite.init()
      mite.init()

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Mite] SDK already initialized')
      mite.destroy()
    })

    it('respects enableOfflineQueue=false', () => {
      const mite = new Mite({
        apiKey: 'test',
        enableOfflineQueue: false,
      })
      mite.init()

      expect(consoleLogSpy).not.toHaveBeenCalledWith('[Mite] Offline queue enabled')
      mite.destroy()
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

    it('throws without user_identifier or anonymous_id', async () => {
      const mite = new Mite({ apiKey: 'test' })

      await expect(mite.identify({})).rejects.toThrow(
        '[Mite] At least one of user_identifier or anonymous_id is required',
      )
    })

    it('sends identify request', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { id: '123', created: true },
      })

      const mite = new Mite({ apiKey: 'test' })
      const result = await mite.identify({ user_identifier: 'user1' })

      expect(result).toEqual({ id: '123', created: true })
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

  describe('pendingRequestCount', () => {
    it('returns 0 when offline queue is not enabled', () => {
      const mite = new Mite({
        apiKey: 'test',
        enableOfflineQueue: false,
      })
      mite.init()
      expect(mite.pendingRequestCount).toBe(0)
      mite.destroy()
    })
  })

  describe('submitBug', () => {
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
  })
})
