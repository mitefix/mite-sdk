interface ExpoApplicationModule {
  nativeApplicationVersion?: string | null
}

interface ExpoConstantsModule {
  default?: { expoConfig?: { version?: string } | null }
  expoConfig?: { version?: string } | null
}

let warnedMissingVersionSource = false

/**
 * Detect the installed app version. Prefers expo-application (native version),
 * falls back to expo-constants (expoConfig.version). Both modules are optional
 * peer dependencies; returns null with a [Mite] warning when neither is available.
 */
export function getInstalledAppVersion(): string | null {
  try {
    const ExpoApplication = require('expo-application') as ExpoApplicationModule
    if (ExpoApplication?.nativeApplicationVersion) {
      return ExpoApplication.nativeApplicationVersion
    }
  } catch {
    // expo-application is an optional dependency
  }

  try {
    const ExpoConstants = require('expo-constants') as ExpoConstantsModule
    const constants = ExpoConstants?.default ?? ExpoConstants
    const version = constants?.expoConfig?.version
    if (version) {
      return version
    }
  } catch {
    // expo-constants is an optional dependency
  }

  if (!warnedMissingVersionSource) {
    warnedMissingVersionSource = true
    console.warn(
      '[Mite] Unable to detect the installed app version. Install expo-application (or expo-constants), or pass currentVersion to useWhatsNew/WhatsNew.',
    )
  }

  return null
}
