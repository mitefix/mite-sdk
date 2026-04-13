import { RootProvider } from 'fumadocs-ui/provider/next'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './global.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Mite SDK',
    default: 'Mite SDK Docs',
  },
  description:
    'Documentation for the Mite SDK — bug reporting, release management, and feature requests for React Native.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
