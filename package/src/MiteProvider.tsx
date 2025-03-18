import { createContext, useContext } from 'react'
import type { Mite } from './Mite'

const MiteContext = createContext<Mite | null>(null)

export function MiteProvider({
  children,
  miteInstance,
}: { children: React.ReactNode; miteInstance: Mite }) {
  return <MiteContext.Provider value={miteInstance}>{children}</MiteContext.Provider>
}

export function useMite() {
  const mite = useContext(MiteContext)
  if (!mite) {
    throw new Error('useMite must be used within a MiteProvider')
  }
  return mite
}
