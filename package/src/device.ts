import * as Device from 'expo-device'
import { Dimensions } from 'react-native'

/**
 * Snapshot of the current device as a flat string record — the only
 * shape the Mite API accepts for `device_info`.
 */
export function getDeviceInfo(): Record<string, string> {
  const screen = Dimensions.get('screen')
  const raw: Record<string, string | number | boolean | null> = {
    os: Device.osName,
    osVersion: Device.osVersion,
    manufacturer: Device.manufacturer,
    model: Device.modelName,
    device: Device.deviceName,
    isEmulator: !Device.isDevice,
    screenWidth: screen.width,
    screenHeight: screen.height,
  }

  const info: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== null && value !== undefined) {
      info[key] = String(value)
    }
  }
  return info
}
