import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-2xl space-y-6">
        <p className="text-5xl">🐛</p>
        <h1 className="text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">
          Mite SDK
        </h1>
        <p className="text-lg text-fd-muted-foreground">
          Bug reporting, release management, and feature requests for React Native apps.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex h-10 items-center rounded-none bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground transition-colors hover:opacity-90"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/usemite/mite-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-none border border-fd-border px-6 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>
      </div>
    </main>
  )
}
