export function generateAnonymousId(): string {
  const cryptoObject = (
    globalThis as typeof globalThis & {
      crypto?: { randomUUID?: () => string }
    }
  ).crypto

  const randomId = cryptoObject?.randomUUID?.()
  if (randomId) {
    return `anon_${randomId}`
  }

  return `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
