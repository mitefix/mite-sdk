import { ErrorHandler } from '../ErrorHandler'

describe('ErrorHandler', () => {
  let originalErrorUtils: unknown

  beforeEach(() => {
    const g = globalThis as Record<string, unknown>
    originalErrorUtils = g.ErrorUtils
    g.ErrorUtils = {
      getGlobalHandler: jest.fn(() => jest.fn()),
      setGlobalHandler: jest.fn(),
    }
    g.onunhandledrejection = undefined
  })

  afterEach(() => {
    const g = globalThis as Record<string, unknown>
    g.ErrorUtils = originalErrorUtils
    g.onunhandledrejection = undefined
  })

  it('installs global error handler', () => {
    const onError = jest.fn()
    const handler = new ErrorHandler(onError)

    handler.install()

    const g = globalThis as Record<string, unknown>
    const errorUtils = g.ErrorUtils as {
      setGlobalHandler: jest.Mock
    }
    expect(errorUtils.setGlobalHandler).toHaveBeenCalledTimes(1)
  })

  it('installs promise rejection handler', () => {
    const onError = jest.fn()
    const handler = new ErrorHandler(onError)

    handler.install()

    const g = globalThis as Record<string, unknown>
    expect(typeof g.onunhandledrejection).toBe('function')
  })

  it('captures promise rejections as errors', () => {
    const onError = jest.fn()
    const handler = new ErrorHandler(onError)
    handler.install()

    const g = globalThis as Record<string, unknown>
    const rejectionHandler = g.onunhandledrejection as (event: {
      reason: unknown
    }) => void
    rejectionHandler({ reason: new Error('test rejection') })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'test rejection' }),
      false,
    )
  })

  it('converts non-Error rejections to Error objects', () => {
    const onError = jest.fn()
    const handler = new ErrorHandler(onError)
    handler.install()

    const g = globalThis as Record<string, unknown>
    const rejectionHandler = g.onunhandledrejection as (event: {
      reason: unknown
    }) => void
    rejectionHandler({ reason: 'string rejection' })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'string rejection' }),
      false,
    )
  })

  it('does not install twice', () => {
    const onError = jest.fn()
    const handler = new ErrorHandler(onError)

    handler.install()
    handler.install()

    const g = globalThis as Record<string, unknown>
    const errorUtils = g.ErrorUtils as {
      setGlobalHandler: jest.Mock
    }
    expect(errorUtils.setGlobalHandler).toHaveBeenCalledTimes(1)
  })

  it('restores original handler on uninstall', () => {
    const originalHandler = jest.fn()
    const g = globalThis as Record<string, unknown>
    ;(g.ErrorUtils as Record<string, unknown>).getGlobalHandler = jest.fn(
      () => originalHandler,
    )

    const onError = jest.fn()
    const handler = new ErrorHandler(onError)
    handler.install()
    handler.uninstall()

    const errorUtils = g.ErrorUtils as {
      setGlobalHandler: jest.Mock
    }
    // Called once to install, once to restore
    expect(errorUtils.setGlobalHandler).toHaveBeenCalledTimes(2)
    expect(errorUtils.setGlobalHandler).toHaveBeenLastCalledWith(originalHandler)
  })

  it('chains with previous error handler', () => {
    const previousHandler = jest.fn()
    const g = globalThis as Record<string, unknown>
    ;(g.ErrorUtils as Record<string, unknown>).getGlobalHandler = jest.fn(
      () => previousHandler,
    )

    const onError = jest.fn()
    const handler = new ErrorHandler(onError)
    handler.install()

    const errorUtils = g.ErrorUtils as {
      setGlobalHandler: jest.Mock
    }
    const installedHandler = errorUtils.setGlobalHandler.mock.calls[0][0] as (
      error: Error,
      isFatal: boolean,
    ) => void
    const testError = new Error('test')
    installedHandler(testError, true)

    expect(onError).toHaveBeenCalledWith(testError, true)
    expect(previousHandler).toHaveBeenCalledWith(testError, true)
  })

  it('does not crash if onError throws', () => {
    const onError = jest.fn(() => {
      throw new Error('handler error')
    })
    const previousHandler = jest.fn()
    const g = globalThis as Record<string, unknown>
    ;(g.ErrorUtils as Record<string, unknown>).getGlobalHandler = jest.fn(
      () => previousHandler,
    )

    const handler = new ErrorHandler(onError)
    handler.install()

    const errorUtils = g.ErrorUtils as {
      setGlobalHandler: jest.Mock
    }
    const installedHandler = errorUtils.setGlobalHandler.mock.calls[0][0] as (
      error: Error,
      isFatal: boolean,
    ) => void

    expect(() => installedHandler(new Error('test'), false)).not.toThrow()
    expect(previousHandler).toHaveBeenCalled()
  })
})
