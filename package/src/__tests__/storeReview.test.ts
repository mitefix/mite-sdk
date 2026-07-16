const mockIsAvailableAsync = jest.fn()
const mockRequestReview = jest.fn()

jest.mock(
  'expo-store-review',
  () => ({
    isAvailableAsync: mockIsAvailableAsync,
    requestReview: mockRequestReview,
  }),
  { virtual: true },
)

describe('storeReview (expo-store-review installed)', () => {
  let consoleWarnSpy: jest.SpyInstance
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  function loadStoreReviewUtils(): typeof import('../utils/storeReview') {
    return require('../utils/storeReview')
  }

  it('requests a review when the dialog is available', async () => {
    mockIsAvailableAsync.mockResolvedValue(true)
    mockRequestReview.mockResolvedValue(undefined)

    const { requestStoreReview } = loadStoreReviewUtils()

    await expect(requestStoreReview()).resolves.toBe(true)
    expect(mockRequestReview).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('resolves to false when the dialog is unavailable on the device', async () => {
    mockIsAvailableAsync.mockResolvedValue(false)

    const { requestStoreReview } = loadStoreReviewUtils()

    await expect(requestStoreReview()).resolves.toBe(false)
    expect(mockRequestReview).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Mite] Store review is not available on this device',
    )
  })

  it('resolves to false and warns when the native request throws', async () => {
    mockIsAvailableAsync.mockResolvedValue(true)
    mockRequestReview.mockRejectedValue(new Error('native failure'))

    const { requestStoreReview } = loadStoreReviewUtils()

    await expect(requestStoreReview()).resolves.toBe(false)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Mite] Failed to request store review:',
      expect.any(Error),
    )
  })

  it('isStoreReviewAvailable reflects the native availability', async () => {
    mockIsAvailableAsync.mockResolvedValue(true)

    const { isStoreReviewAvailable } = loadStoreReviewUtils()

    await expect(isStoreReviewAvailable()).resolves.toBe(true)
    expect(mockRequestReview).not.toHaveBeenCalled()
  })

  it('isStoreReviewAvailable resolves to false when the availability check throws', async () => {
    mockIsAvailableAsync.mockRejectedValue(new Error('native failure'))

    const { isStoreReviewAvailable } = loadStoreReviewUtils()

    await expect(isStoreReviewAvailable()).resolves.toBe(false)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Mite] Failed to check store review availability:',
      expect.any(Error),
    )
  })
})
