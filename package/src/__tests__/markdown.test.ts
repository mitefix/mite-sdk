import { parseInline, parseMarkdown } from '../utils/markdown'

describe('parseInline', () => {
  it('returns plain text as a single token', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', content: 'hello world' }])
  })

  it('parses bold segments', () => {
    expect(parseInline('a **bold** word')).toEqual([
      { type: 'text', content: 'a ' },
      { type: 'bold', content: 'bold' },
      { type: 'text', content: ' word' },
    ])
  })

  it('parses italic segments with asterisks and underscores', () => {
    expect(parseInline('*one* and _two_')).toEqual([
      { type: 'italic', content: 'one' },
      { type: 'text', content: ' and ' },
      { type: 'italic', content: 'two' },
    ])
  })

  it('parses inline code', () => {
    expect(parseInline('run `mite init` now')).toEqual([
      { type: 'text', content: 'run ' },
      { type: 'code', content: 'mite init' },
      { type: 'text', content: ' now' },
    ])
  })

  it('leaves unbalanced markers as text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', content: '2 * 3 = 6' }])
  })
})

describe('parseMarkdown', () => {
  it('parses headings, bullets, and paragraphs', () => {
    const blocks = parseMarkdown(
      '# v1.2.0\n\nBig update!\n\n## Fixes\n- Fixed **crash** on launch\n* Faster startup\n',
    )

    expect(blocks).toEqual([
      { type: 'heading', level: 1, tokens: [{ type: 'text', content: 'v1.2.0' }] },
      { type: 'paragraph', tokens: [{ type: 'text', content: 'Big update!' }] },
      { type: 'heading', level: 2, tokens: [{ type: 'text', content: 'Fixes' }] },
      {
        type: 'bullet',
        tokens: [
          { type: 'text', content: 'Fixed ' },
          { type: 'bold', content: 'crash' },
          { type: 'text', content: ' on launch' },
        ],
      },
      { type: 'bullet', tokens: [{ type: 'text', content: 'Faster startup' }] },
    ])
  })

  it('joins consecutive lines into a single paragraph', () => {
    expect(parseMarkdown('line one\nline two\n\nline three')).toEqual([
      { type: 'paragraph', tokens: [{ type: 'text', content: 'line one line two' }] },
      { type: 'paragraph', tokens: [{ type: 'text', content: 'line three' }] },
    ])
  })

  it('does not treat italic-leading lines as bullets', () => {
    expect(parseMarkdown('*emphasis* first')).toEqual([
      {
        type: 'paragraph',
        tokens: [
          { type: 'italic', content: 'emphasis' },
          { type: 'text', content: ' first' },
        ],
      },
    ])
  })

  it('returns no blocks for empty input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('\n\n')).toEqual([])
  })
})
