import { createContext, useContext } from 'react'
import type { Mite } from './Mite'

const MiteContext = createContext<Mite | null>(null)

export function MiteProvider({
  children,
  instance,
}: { children: React.ReactNode; instance: Mite }) {
  return <MiteContext.Provider value={instance}>{children}</MiteContext.Provider>
}

export function useMite(): Mite {
  const mite = useContext(MiteContext)
  if (!mite) {
    throw new Error('[Mite] useMite must be used within a MiteProvider')
  }
  return mite
}
