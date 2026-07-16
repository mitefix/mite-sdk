import {
  NavigationTracker,
  clearNavigationTrail,
  getNavigationTrail,
  navigationTracker,
  recordNavigationBreadcrumb,
} from '../NavigationTracker'

describe('NavigationTracker', () => {
  let tracker: NavigationTracker

  beforeEach(() => {
    tracker = new NavigationTracker()
  })

  it('records breadcrumbs with screen and timestamp', () => {
    const before = Date.now()
    tracker.record('Home')

    const trail = tracker.getTrail()
    expect(trail).toHaveLength(1)
    expect(trail[0]?.screen).toBe('Home')
    expect(trail[0]?.timestamp).toBeGreaterThanOrEqual(before)
  })

  it('keeps breadcrumbs in visit order', () => {
    tracker.record('Home')
    tracker.record('Settings')
    tracker.record('Profile')

    expect(tracker.getTrail().map(b => b.screen)).toEqual(['Home', 'Settings', 'Profile'])
  })

  it('deduplicates consecutive records of the same screen', () => {
    tracker.record('Home')
    tracker.record('Home')
    tracker.record('Settings')
    tracker.record('Home')

    expect(tracker.getTrail().map(b => b.screen)).toEqual(['Home', 'Settings', 'Home'])
  })

  it('drops the oldest breadcrumbs beyond the maximum (default 20)', () => {
    for (let i = 1; i <= 25; i++) {
      tracker.record(`Screen${i}`)
    }

    const trail = tracker.getTrail()
    expect(trail).toHaveLength(20)
    expect(trail[0]?.screen).toBe('Screen6')
    expect(trail[19]?.screen).toBe('Screen25')
  })

  it('respects a configured maximum', () => {
    tracker.configure({ maxBreadcrumbs: 3 })
    tracker.record('A')
    tracker.record('B')
    tracker.record('C')
    tracker.record('D')

    expect(tracker.getTrail().map(b => b.screen)).toEqual(['B', 'C', 'D'])
  })

  it('trims existing breadcrumbs when the maximum shrinks', () => {
    tracker.record('A')
    tracker.record('B')
    tracker.record('C')
    tracker.configure({ maxBreadcrumbs: 2 })

    expect(tracker.getTrail().map(b => b.screen)).toEqual(['B', 'C'])
  })

  it('ignores empty and non-string screens', () => {
    tracker.record('')
    tracker.record('   ')
    tracker.record(undefined as unknown as string)

    expect(tracker.getTrail()).toHaveLength(0)
  })

  it('records nothing while disabled and clears existing breadcrumbs', () => {
    tracker.record('Home')
    tracker.configure({ enabled: false })
    tracker.record('Settings')

    expect(tracker.getTrail()).toHaveLength(0)
  })

  it('clears the trail', () => {
    tracker.record('Home')
    tracker.clear()

    expect(tracker.getTrail()).toHaveLength(0)
  })

  it('returns copies so callers cannot mutate internal state', () => {
    tracker.record('Home')
    const trail = tracker.getTrail()
    if (trail[0]) {
      trail[0].screen = 'Mutated'
    }

    expect(tracker.getTrail()[0]?.screen).toBe('Home')
  })
})

describe('navigation trail helpers', () => {
  afterEach(() => {
    navigationTracker.configure({ enabled: true })
    navigationTracker.clear()
  })

  it('records, reads, and clears breadcrumbs on the shared tracker', () => {
    recordNavigationBreadcrumb('Home')
    recordNavigationBreadcrumb('Settings')

    expect(getNavigationTrail().map(b => b.screen)).toEqual(['Home', 'Settings'])

    clearNavigationTrail()
    expect(getNavigationTrail()).toHaveLength(0)
  })
})
