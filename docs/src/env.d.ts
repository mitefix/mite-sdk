declare module 'collections/server' {
  import type { Source } from 'fumadocs-core/source'
  export const docs: {
    toFumadocsSource(): Source
  }
}
