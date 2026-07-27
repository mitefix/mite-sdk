import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import Image from 'next/image'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={24} height={24} className="size-6" />
          <span className="text-[15px] font-semibold tracking-[0.01em]">Mite</span>
          <span className="bg-fd-muted px-1.5 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-fd-muted-foreground">
            SDK
          </span>
        </span>
      ),
      url: '/',
    },
    githubUrl: 'https://github.com/usemite/mite-sdk',
  }
}
