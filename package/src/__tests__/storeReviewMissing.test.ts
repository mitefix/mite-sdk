describe('storeReview (expo-store-review not installed)', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  function loadStoreReviewUtils(): typeof import('../utils/storeReview') {
    return require('../utils/storeReview')
  }

  it('requestStoreReview resolves to false and warns once', async () => {
    const { requestStoreReview } = loadStoreReviewUtils()

    await expect(requestStoreReview()).resolves.toBe(false)
    await expect(requestStoreReview()).resolves.toBe(false)

    const warnings = consoleWarnSpy.mock.calls.filter(call =>
      String(call[0]).includes('[Mite] expo-store-review is not installed'),
    )
    expect(warnings).toHaveLength(1)
  })

  it('isStoreReviewAvailable resolves to false', async () => {
    const { isStoreReviewAvailable } = loadStoreReviewUtils()

    await expect(isStoreReviewAvailable()).resolves.toBe(false)
  })
})
