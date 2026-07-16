import { Platform, StyleSheet, Text, View } from 'react-native'
import {
  type MarkdownBlock,
  type MarkdownInlineToken,
  parseMarkdown,
} from '../utils/markdown'

interface MarkdownTextProps {
  markdown: string
  color: string
  codeBackgroundColor: string
}

function InlineTokens({
  tokens,
  codeBackgroundColor,
}: {
  tokens: MarkdownInlineToken[]
  codeBackgroundColor: string
}) {
  return (
    <>
      {tokens.map((token, index) => {
        const key = `${index}-${token.content}`

        switch (token.type) {
          case 'bold':
            return (
              <Text key={key} style={styles.bold}>
                {token.content}
              </Text>
            )
          case 'italic':
            return (
              <Text key={key} style={styles.italic}>
                {token.content}
              </Text>
            )
          case 'code':
            return (
              <Text
                key={key}
                style={[styles.code, { backgroundColor: codeBackgroundColor }]}
              >
                {token.content}
              </Text>
            )
          default:
            return <Text key={key}>{token.content}</Text>
        }
      })}
    </>
  )
}

function Block({
  block,
  color,
  codeBackgroundColor,
}: {
  block: MarkdownBlock
  color: string
  codeBackgroundColor: string
}) {
  if (block.type === 'heading') {
    const headingStyle =
      block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3

    return (
      <Text style={[headingStyle, { color }]}>
        <InlineTokens tokens={block.tokens} codeBackgroundColor={codeBackgroundColor} />
      </Text>
    )
  }

  if (block.type === 'bullet') {
    return (
      <View style={styles.bulletRow}>
        <Text style={[styles.bulletMarker, { color }]}>{'•'}</Text>
        <Text style={[styles.paragraph, styles.bulletContent, { color }]}>
          <InlineTokens tokens={block.tokens} codeBackgroundColor={codeBackgroundColor} />
        </Text>
      </View>
    )
  }

  return (
    <Text style={[styles.paragraph, { color }]}>
      <InlineTokens tokens={block.tokens} codeBackgroundColor={codeBackgroundColor} />
    </Text>
  )
}

export function MarkdownText({
  markdown,
  color,
  codeBackgroundColor,
}: MarkdownTextProps) {
  const blocks = parseMarkdown(markdown)

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => (
        <Block
          key={`${index}-${block.type}`}
          block={block}
          color={color}
          codeBackgroundColor={codeBackgroundColor}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    gap: 8,
  },
  bulletMarker: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletContent: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 14,
  },
})
