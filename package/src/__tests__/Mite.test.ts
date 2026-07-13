import { afterEach, describe, expect, it, mock } from 'bun:test'

mock.module('expo-device', () => ({
  osName: 'iOS',
  osVersion: '18.0',
  manufacturer: 'Apple',
  modelName: 'iPhone 16',
  deviceName: null,
  isDevice: true,
}))

mock.module('react-native', () => ({
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}))

const { MiteError } = await import('../errors')
const { Mite } = await import('../Mite')

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeMite() {
  return new Mite({ apiKey: 'test-key', endpoint: 'https://api.test', maxRetries: 0 })
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('Mite', () => {
  it('requires an apiKey', () => {
    expect(() => new Mite({ apiKey: '' })).toThrow(MiteError)
  })

  it('maps submitBug payload to the snake_case wire format', async () => {
    const fetchMock = mock(async () => jsonResponse({ id: 'bug_1', status: 'OPEN' }, 201))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await makeMite().submitBug({
      title: 'Crash on launch',
      description: 'App crashes immediately',
      userIdentifier: 'user_42',
      reporterEmail: 'a@b.co',
      stepsToReproduce: 'Open the app',
      priority: 'HIGH',
      appVersion: '1.2.3',
    })

    expect(result.id).toBe('bug_1')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/api/v1/bug-reports')
    const body = JSON.parse(init.body as string)
    expect(body.user_identifier).toBe('user_42')
    expect(body.reporter_email).toBe('a@b.co')
    expect(body.steps_to_reproduce).toBe('Open the app')
    expect(body.app_version).toBe('1.2.3')
    expect(body.userIdentifier).toBeUndefined()
  })

  it('sends device_info as a flat string record', async () => {
    const fetchMock = mock(async () => jsonResponse({ id: 'bug_1', status: 'OPEN' }, 201))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await makeMite().submitBug({ title: 't', description: 'd' })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.device_info.os).toBe('iOS')
    expect(body.device_info.model).toBe('iPhone 16')
    expect(body.device_info.screenWidth).toBe('390')
    expect(body.device_info.isEmulator).toBe('false')
    expect(body.device_info.device).toBeUndefined()
    for (const value of Object.values(body.device_info)) {
      expect(typeof value).toBe('string')
    }
  })

  it('lets callers override collected device info', async () => {
    const fetchMock = mock(async () => jsonResponse({ id: 'bug_1', status: 'OPEN' }, 201))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await makeMite().submitBug({
      title: 't',
      description: 'd',
      deviceInfo: { os: 'custom-os', locale: 'en-US' },
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.device_info.os).toBe('custom-os')
    expect(body.device_info.locale).toBe('en-US')
  })

  it('identify requires an identifier', async () => {
    await expect(makeMite().identify({ email: 'a@b.co' })).rejects.toThrow(
      /userIdentifier or anonymousId/,
    )
  })

  it('uploads attachments before creating the bug report', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method })
      if (url.endsWith('/api/v1/upload-url')) {
        return jsonResponse({ uploadUrl: 'https://storage.test/upload' })
      }
      if (url === 'file:///tmp/screenshot.png') {
        return new Response(new Blob(['fake'], { type: 'image/png' }))
      }
      if (url === 'https://storage.test/upload') {
        return jsonResponse({ storageId: 'st_123' })
      }
      return jsonResponse({ id: 'bug_1', status: 'OPEN' }, 201)
    }) as unknown as typeof fetch

    await makeMite().submitBug({
      title: 't',
      description: 'd',
      attachments: [{ uri: 'file:///tmp/screenshot.png', fileName: 'screenshot.png' }],
    })

    const reportCall = calls.find(c => c.url.endsWith('/api/v1/bug-reports'))
    expect(reportCall).toBeDefined()
    expect(calls.findIndex(c => c.url === 'https://storage.test/upload')).toBeLessThan(
      calls.indexOf(reportCall as { url: string }),
    )
  })

  it('getReleases unwraps the releases array and passes filters', async () => {
    const fetchMock = mock(async () =>
      jsonResponse({ releases: [{ id: 'r1', version: '1.0.0' }] }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const releases = await makeMite().getReleases({ platform: 'ios', limit: 5 })

    expect(releases).toHaveLength(1)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe('https://api.test/api/v1/releases?platform=ios&limit=5')
  })

  it('voteFeatureRequest maps payload and returns the toggle result', async () => {
    const fetchMock = mock(async () => jsonResponse({ voted: true, voteCount: 4 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await makeMite().voteFeatureRequest({
      featureRequestId: 'fr_1',
      voterEmail: 'a@b.co',
    })

    expect(result).toEqual({ voted: true, voteCount: 4 })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.feature_request_id).toBe('fr_1')
    expect(body.voter_email).toBe('a@b.co')
  })
})
