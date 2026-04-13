import type { MiteIdentityStorage } from '../types'

/** MMKV-compatible interface (react-native-mmkv) */
interface MMKVLike {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

interface LocalStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type GlobalWithLocalStorage = typeof globalThis & {
  localStorage?: LocalStorageLike
}

function createInMemoryStorage(): MiteIdentityStorage {
  const memoryStorage = new Map<string, string>()

  return {
    getItem(key) {
      return memoryStorage.get(key) ?? null
    },
    setItem(key, value) {
      memoryStorage.set(key, value)
    },
    removeItem(key) {
      memoryStorage.delete(key)
    },
  }
}

function hasLocalStorage(): boolean {
  try {
    const localStorage = (globalThis as GlobalWithLocalStorage).localStorage

    return Boolean(
      localStorage &&
        typeof localStorage.getItem === 'function' &&
        typeof localStorage.setItem === 'function' &&
        typeof localStorage.removeItem === 'function',
    )
  } catch {
    return false
  }
}

function createLocalStorageAdapter(): MiteIdentityStorage {
  const localStorage = (globalThis as GlobalWithLocalStorage).localStorage

  return {
    getItem(key) {
      return localStorage?.getItem(key) ?? null
    },
    setItem(key, value) {
      localStorage?.setItem(key, value)
    },
    removeItem(key) {
      localStorage?.removeItem(key)
    },
  }
}

function isMMKV(storage: unknown): storage is MMKVLike {
  return (
    typeof storage === 'object' &&
    storage !== null &&
    typeof (storage as MMKVLike).getString === 'function' &&
    typeof (storage as MMKVLike).set === 'function' &&
    typeof (storage as MMKVLike).delete === 'function'
  )
}

function createMMKVAdapter(mmkv: MMKVLike): MiteIdentityStorage {
  return {
    getItem(key) {
      return mmkv.getString(key) ?? null
    },
    setItem(key, value) {
      mmkv.set(key, value)
    },
    removeItem(key) {
      mmkv.delete(key)
    },
  }
}

export function resolveIdentityStorage(storage?: MiteIdentityStorage | MMKVLike): {
  storage: MiteIdentityStorage
  isPersistent: boolean
} {
  if (storage) {
    return {
      storage: isMMKV(storage) ? createMMKVAdapter(storage) : storage,
      isPersistent: true,
    }
  }

  if (hasLocalStorage()) {
    return {
      storage: createLocalStorageAdapter(),
      isPersistent: true,
    }
  }

  return {
    storage: createInMemoryStorage(),
    isPersistent: false,
  }
}
