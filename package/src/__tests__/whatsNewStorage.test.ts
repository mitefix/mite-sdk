import { Mite } from '../Mite'
import type { MiteIdentityStorage } from '../types'

jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn().mockResolvedValue({ data: {} }),
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

function createStorage(initialState?: Record<string, string>): {
  storage: MiteIdentityStorage
  store: Map<string, string>
} {
  const store = new Map(Object.entries(initialState ?? {}))

  return {
    store,
    storage: {
      async getItem(key) {
        return store.get(key) ?? null
      },
      async setItem(key, value) {
        store.set(key, value)
      },
      async removeItem(key) {
        store.delete(key)
      },
    },
  }
}

describe('Mite last seen release version', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns null when no version has been seen', async () => {
    const { storage } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await expect(mite.getLastSeenReleaseVersion()).resolves.toBeNull()
  })

  it('persists and reads back the last seen version', async () => {
    const { storage, store } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await mite.setLastSeenReleaseVersion('1.4.0')

    expect(store.get('@mite/sdk-last-seen-release')).toBe('1.4.0')
    await expect(mite.getLastSeenReleaseVersion()).resolves.toBe('1.4.0')
  })

  it('returns null when storage reads fail', async () => {
    const { storage } = createStorage()
    const mite = new Mite({
      apiKey: 'test-key',
      identityStorage: {
        ...storage,
        async getItem(key) {
          if (key === '@mite/sdk-last-seen-release') {
            throw new Error('storage unavailable')
          }
          return storage.getItem(key)
        },
      },
    })

    await expect(mite.getLastSeenReleaseVersion()).resolves.toBeNull()
  })

  it('warns instead of throwing when storage writes fail', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const { storage } = createStorage()
    const mite = new Mite({
      apiKey: 'test-key',
      identityStorage: {
        ...storage,
        async setItem(key, value) {
          if (key === '@mite/sdk-last-seen-release') {
            throw new Error('storage unavailable')
          }
          return storage.setItem(key, value)
        },
      },
    })

    await expect(mite.setLastSeenReleaseVersion('2.0.0')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      '[Mite] Failed to persist the last seen release version',
    )
  })
})
