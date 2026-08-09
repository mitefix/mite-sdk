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

const SEEN_KEY = '@mite/sdk-seen-announcements'

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

describe('Mite seen announcements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns an empty list when nothing has been seen', async () => {
    const { storage } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual([])
  })

  it('persists and reads back seen ids without duplicates', async () => {
    const { storage, store } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await mite.markAnnouncementSeen('ann_1')
    await mite.markAnnouncementSeen('ann_2')
    await mite.markAnnouncementSeen('ann_1')

    expect(JSON.parse(store.get(SEEN_KEY) ?? '[]')).toEqual(['ann_1', 'ann_2'])
    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual(['ann_1', 'ann_2'])
  })

  it('caps the stored list at 100 ids, dropping the oldest', async () => {
    const { storage } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    for (let i = 0; i < 105; i++) {
      await mite.markAnnouncementSeen(`ann_${i}`)
    }

    const seen = await mite.getSeenAnnouncementIds()
    expect(seen).toHaveLength(100)
    expect(seen[0]).toBe('ann_5')
    expect(seen[99]).toBe('ann_104')
  })

  it('returns an empty list for corrupt stored state', async () => {
    const { storage } = createStorage({ [SEEN_KEY]: 'not json' })
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual([])
  })

  it('ignores non-string entries in stored state', async () => {
    const { storage } = createStorage({
      [SEEN_KEY]: JSON.stringify(['ann_1', 42, null, 'ann_2']),
    })
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual(['ann_1', 'ann_2'])
  })

  it('returns an empty list when storage reads fail', async () => {
    const { storage } = createStorage()
    const mite = new Mite({
      apiKey: 'test-key',
      identityStorage: {
        ...storage,
        async getItem(key) {
          if (key === SEEN_KEY) {
            throw new Error('storage unavailable')
          }
          return storage.getItem(key)
        },
      },
    })

    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual([])
  })

  it('warns instead of throwing when storage writes fail', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const { storage } = createStorage()
    const mite = new Mite({
      apiKey: 'test-key',
      identityStorage: {
        ...storage,
        async setItem(key, value) {
          if (key === SEEN_KEY) {
            throw new Error('storage unavailable')
          }
          return storage.setItem(key, value)
        },
      },
    })

    await expect(mite.markAnnouncementSeen('ann_1')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      '[Mite] Failed to persist the seen announcements',
    )
  })

  it('clears the seen list', async () => {
    const { storage, store } = createStorage()
    const mite = new Mite({ apiKey: 'test-key', identityStorage: storage })

    await mite.markAnnouncementSeen('ann_1')
    await mite.clearSeenAnnouncements()

    expect(store.has(SEEN_KEY)).toBe(false)
    await expect(mite.getSeenAnnouncementIds()).resolves.toEqual([])
  })
})
