export type FlatStringRecord = Record<string, string>

function stringifyDeviceInfoValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? String(value) : serialized
  } catch {
    return String(value)
  }
}

export function normalizeDeviceInfo(
  deviceInfo?: Record<string, unknown>,
): FlatStringRecord {
  if (!deviceInfo) {
    return {}
  }

  const normalized: FlatStringRecord = {}

  for (const [key, value] of Object.entries(deviceInfo)) {
    const stringValue = stringifyDeviceInfoValue(value)
    if (stringValue !== undefined) {
      normalized[key] = stringValue
    }
  }

  return normalized
}
