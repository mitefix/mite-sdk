import type { MiteIdentityStorage } from '../types'

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
      localStorage
      && typeof localStorage.getItem === 'function'
      && typeof localStorage.setItem === 'function'
      && typeof localStorage.removeItem === 'function',
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

export function resolveIdentityStorage(
  storage?: MiteIdentityStorage,
): { storage: MiteIdentityStorage; isPersistent: boolean } {
  if (storage) {
    return {
      storage,
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
