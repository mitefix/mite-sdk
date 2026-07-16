import {
  type AccelerometerModule,
  type AccelerometerSubscription,
  loadExpoSensors,
} from './utils/optionalModules'

export interface ShakeDetectorOptions {
  /**
   * Total acceleration magnitude (in g) a sample must exceed to count as a shake
   * movement. Gravity contributes ~1g at rest.
   * @default 1.8
   */
  threshold?: number
  /**
   * Number of over-threshold samples required within `shakeWindowMs` to fire.
   * @default 3
   */
  minShakes?: number
  /**
   * Window in which `minShakes` samples must occur.
   * @default 1000
   */
  shakeWindowMs?: number
  /**
   * Time after a detected shake during which new shakes are ignored.
   * @default 2000
   */
  cooldownMs?: number
  /**
   * Accelerometer sampling interval.
   * @default 100
   */
  updateIntervalMs?: number
  /**
   * Override the accelerometer implementation. Intended for testing.
   */
  accelerometerModule?: AccelerometerModule
}

/**
 * Detects shake gestures using the device accelerometer (expo-sensors).
 * No-ops gracefully when expo-sensors is not installed.
 */
export class ShakeDetector {
  private threshold: number
  private minShakes: number
  private shakeWindowMs: number
  private cooldownMs: number
  private updateIntervalMs: number
  private accelerometerModule?: AccelerometerModule

  private subscription: AccelerometerSubscription | null = null
  private overThresholdCount = 0
  private windowStartedAt = 0
  private lastShakeAt = 0

  constructor(options: ShakeDetectorOptions = {}) {
    this.threshold = options.threshold ?? 1.8
    this.minShakes = options.minShakes ?? 3
    this.shakeWindowMs = options.shakeWindowMs ?? 1000
    this.cooldownMs = options.cooldownMs ?? 2000
    this.updateIntervalMs = options.updateIntervalMs ?? 100
    this.accelerometerModule = options.accelerometerModule
  }

  /**
   * Start listening for shake gestures.
   * Returns false when the accelerometer is unavailable.
   */
  start(onShake: () => void): boolean {
    if (this.subscription) {
      return true
    }

    const accelerometer = this.accelerometerModule ?? loadExpoSensors()?.Accelerometer
    if (!accelerometer) {
      return false
    }

    accelerometer.setUpdateInterval(this.updateIntervalMs)
    this.subscription = accelerometer.addListener(measurement => {
      this.handleMeasurement(measurement, onShake)
    })

    return true
  }

  /**
   * Stop listening for shake gestures.
   */
  stop(): void {
    this.subscription?.remove()
    this.subscription = null
    this.overThresholdCount = 0
    this.windowStartedAt = 0
  }

  private handleMeasurement(
    measurement: { x: number; y: number; z: number },
    onShake: () => void,
  ): void {
    const now = Date.now()

    if (now - this.lastShakeAt < this.cooldownMs) {
      return
    }

    const { x, y, z } = measurement
    const magnitude = Math.sqrt(x * x + y * y + z * z)

    if (magnitude < this.threshold) {
      return
    }

    if (now - this.windowStartedAt > this.shakeWindowMs) {
      this.overThresholdCount = 0
      this.windowStartedAt = now
    }

    this.overThresholdCount += 1

    if (this.overThresholdCount >= this.minShakes) {
      this.overThresholdCount = 0
      this.windowStartedAt = 0
      this.lastShakeAt = now
      onShake()
    }
  }
}
