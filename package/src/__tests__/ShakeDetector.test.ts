import { ShakeDetector } from '../ShakeDetector'
import type {
  AccelerometerMeasurement,
  AccelerometerModule,
} from '../utils/optionalModules'

jest.mock('expo-sensors', () => ({}), { virtual: true })

function createFakeAccelerometer() {
  let listener: ((measurement: AccelerometerMeasurement) => void) | null = null
  const remove = jest.fn(() => {
    listener = null
  })
  const setUpdateInterval = jest.fn()

  const module: AccelerometerModule = {
    addListener: fn => {
      listener = fn
      return { remove }
    },
    setUpdateInterval,
  }

  return {
    module,
    remove,
    setUpdateInterval,
    emit: (measurement: AccelerometerMeasurement) => {
      listener?.(measurement)
    },
  }
}

const SHAKE: AccelerometerMeasurement = { x: 2, y: 2, z: 2 }
const REST: AccelerometerMeasurement = { x: 0, y: 0, z: 1 }

describe('ShakeDetector', () => {
  let nowSpy: jest.SpyInstance<number, []>
  let now: number

  beforeEach(() => {
    now = 1_000_000
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  it('returns false from start when no accelerometer is available', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const detector = new ShakeDetector()

    expect(detector.start(jest.fn())).toBe(false)

    consoleWarnSpy.mockRestore()
  })

  it('fires onShake after enough over-threshold samples within the window', () => {
    const fake = createFakeAccelerometer()
    const onShake = jest.fn()
    const detector = new ShakeDetector({ accelerometerModule: fake.module })

    expect(detector.start(onShake)).toBe(true)
    expect(fake.setUpdateInterval).toHaveBeenCalledWith(100)

    fake.emit(SHAKE)
    now += 100
    fake.emit(SHAKE)
    expect(onShake).not.toHaveBeenCalled()

    now += 100
    fake.emit(SHAKE)
    expect(onShake).toHaveBeenCalledTimes(1)

    detector.stop()
  })

  it('ignores below-threshold samples', () => {
    const fake = createFakeAccelerometer()
    const onShake = jest.fn()
    const detector = new ShakeDetector({
      accelerometerModule: fake.module,
      minShakes: 2,
    })
    detector.start(onShake)

    fake.emit(REST)
    now += 100
    fake.emit(REST)
    now += 100
    fake.emit(REST)

    expect(onShake).not.toHaveBeenCalled()
    detector.stop()
  })

  it('resets the count when samples fall outside the shake window', () => {
    const fake = createFakeAccelerometer()
    const onShake = jest.fn()
    const detector = new ShakeDetector({
      accelerometerModule: fake.module,
      minShakes: 2,
      shakeWindowMs: 500,
    })
    detector.start(onShake)

    fake.emit(SHAKE)
    now += 1000
    fake.emit(SHAKE)

    expect(onShake).not.toHaveBeenCalled()

    now += 100
    fake.emit(SHAKE)
    expect(onShake).toHaveBeenCalledTimes(1)

    detector.stop()
  })

  it('applies a cooldown after a detected shake', () => {
    const fake = createFakeAccelerometer()
    const onShake = jest.fn()
    const detector = new ShakeDetector({
      accelerometerModule: fake.module,
      minShakes: 1,
      cooldownMs: 2000,
    })
    detector.start(onShake)

    fake.emit(SHAKE)
    expect(onShake).toHaveBeenCalledTimes(1)

    now += 500
    fake.emit(SHAKE)
    expect(onShake).toHaveBeenCalledTimes(1)

    now += 2000
    fake.emit(SHAKE)
    expect(onShake).toHaveBeenCalledTimes(2)

    detector.stop()
  })

  it('removes the subscription on stop', () => {
    const fake = createFakeAccelerometer()
    const detector = new ShakeDetector({ accelerometerModule: fake.module })
    detector.start(jest.fn())

    detector.stop()

    expect(fake.remove).toHaveBeenCalledTimes(1)
  })
})
