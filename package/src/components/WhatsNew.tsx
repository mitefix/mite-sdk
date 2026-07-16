import { useEffect, useRef } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import type { Release } from '../types'
import { type UseWhatsNewOptions, useWhatsNew } from '../useWhatsNew'
import { MarkdownText } from './MarkdownText'

export interface WhatsNewProps extends UseWhatsNewOptions {
  /**
   * Title displayed at the top of the widget.
   * @default "What's New"
   */
  title?: string
  /**
   * Label of the dismiss button.
   * @default 'Got it'
   */
  dismissLabel?: string
  /** Called after the widget is dismissed and the version is marked as seen. */
  onDismiss?: () => void
}

let activeController: (() => void) | null = null

/**
 * Imperatively open the "What's New" release notes.
 * Requires a <WhatsNew /> component to be mounted; no-ops with a warning otherwise.
 */
export function showWhatsNew(): void {
  if (!activeController) {
    console.warn(
      '[Mite] showWhatsNew() called without a mounted <WhatsNew /> component. Render <WhatsNew /> inside your MiteProvider first.',
    )
    return
  }

  activeController()
}

function formatReleaseDate(timestamp?: number): string | null {
  if (!timestamp) {
    return null
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ReleaseNotes({
  release,
  color,
  mutedColor,
  codeBackgroundColor,
}: {
  release: Release
  color: string
  mutedColor: string
  codeBackgroundColor: string
}) {
  const releaseDate = formatReleaseDate(release.releasedAt)

  return (
    <View style={styles.release}>
      <View style={styles.releaseHeader}>
        <Text style={[styles.releaseVersion, { color }]}>v{release.version}</Text>
        {releaseDate && (
          <Text style={[styles.releaseDate, { color: mutedColor }]}>{releaseDate}</Text>
        )}
      </View>
      {release.notes ? (
        <MarkdownText
          markdown={release.notes}
          color={color}
          codeBackgroundColor={codeBackgroundColor}
        />
      ) : (
        <Text style={[styles.emptyNotes, { color: mutedColor }]}>
          No release notes for this version.
        </Text>
      )}
    </View>
  )
}

/**
 * In-app "What's New" widget. Automatically shows the published release notes
 * for the current platform once per new app version, and can be opened on
 * demand with showWhatsNew().
 */
export function WhatsNew({ title, dismissLabel, onDismiss, ...options }: WhatsNewProps) {
  const { visible, releases, show, dismiss } = useWhatsNew(options)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const backgroundColor = isDark ? '#1c1c1e' : '#ffffff'
  const color = isDark ? '#f2f2f7' : '#1c1c1e'
  const mutedColor = isDark ? '#8e8e93' : '#6d6d72'
  const codeBackgroundColor = isDark ? '#2c2c2e' : '#f2f2f7'
  const buttonColor = isDark ? '#0a84ff' : '#007aff'

  const dismissedRef = useRef(false)

  useEffect(() => {
    activeController = show

    return () => {
      if (activeController === show) {
        activeController = null
      }
    }
  }, [show])

  useEffect(() => {
    if (visible) {
      dismissedRef.current = false
    }
  }, [visible])

  const handleDismiss = () => {
    if (dismissedRef.current) {
      return
    }
    dismissedRef.current = true
    void dismiss()
    onDismiss?.()
  }

  return (
    <Modal
      presentationStyle="pageSheet"
      visible={visible}
      animationType="slide"
      onRequestClose={handleDismiss}
      onDismiss={handleDismiss}
    >
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.title, { color }]}>{title ?? "What's New"}</Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {releases.map(release => (
            <ReleaseNotes
              key={release.id}
              release={release}
              color={color}
              mutedColor={mutedColor}
              codeBackgroundColor={codeBackgroundColor}
            />
          ))}
        </ScrollView>
        <Pressable
          style={[styles.dismissButton, { backgroundColor: buttonColor }]}
          onPress={handleDismiss}
        >
          <Text style={styles.dismissText}>{dismissLabel ?? 'Got it'}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 16,
  },
  release: {
    gap: 10,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  releaseVersion: {
    fontSize: 17,
    fontWeight: '600',
  },
  releaseDate: {
    fontSize: 13,
  },
  emptyNotes: {
    fontSize: 15,
  },
  dismissButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})
