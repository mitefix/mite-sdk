export type MarkdownInlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; tokens: MarkdownInlineToken[] }
  | { type: 'bullet'; tokens: MarkdownInlineToken[] }
  | { type: 'paragraph'; tokens: MarkdownInlineToken[] }

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g
const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/
const BULLET_PATTERN = /^[-*]\s+(.*)$/

export function parseInline(text: string): MarkdownInlineToken[] {
  return text
    .split(INLINE_PATTERN)
    .filter(part => part.length > 0)
    .map(part => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 5) {
        return { type: 'bold' as const, content: part.slice(2, -2) }
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 3) {
        return { type: 'code' as const, content: part.slice(1, -1) }
      }
      if (
        part.length >= 3 &&
        ((part.startsWith('*') && part.endsWith('*')) ||
          (part.startsWith('_') && part.endsWith('_')))
      ) {
        return { type: 'italic' as const, content: part.slice(1, -1) }
      }
      return { type: 'text' as const, content: part }
    })
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let paragraphLines: string[] = []

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', tokens: parseInline(paragraphLines.join(' ')) })
      paragraphLines = []
    }
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      continue
    }

    const headingMatch = line.match(HEADING_PATTERN)
    if (headingMatch?.[1] && headingMatch[2] !== undefined) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        tokens: parseInline(headingMatch[2]),
      })
      continue
    }

    const bulletMatch = line.match(BULLET_PATTERN)
    if (bulletMatch?.[1] !== undefined) {
      flushParagraph()
      blocks.push({ type: 'bullet', tokens: parseInline(bulletMatch[1]) })
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph()

  return blocks
}
