import { useEffect, useRef } from 'react'
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import {
  type UseAnnouncementPopupOptions,
  useAnnouncementPopup,
} from '../useAnnouncementPopup'
import { MarkdownText } from './MarkdownText'

export interface AnnouncementPopupProps extends UseAnnouncementPopupOptions {
  /**
   * Label of the dismiss button.
   * @default 'Got it'
   */
  dismissLabel?: string
  /** Called after the popup is dismissed and the announcement is marked as seen. */
  onDismiss?: () => void
  /** Called when the announcement's action button is pressed, before the URL opens. */
  onCtaPress?: (url: string) => void
}

let activeController: (() => void) | null = null

/**
 * Imperatively open the latest announcement, even when it was already seen.
 * Requires an <AnnouncementPopup /> component to be mounted; no-ops with a
 * warning otherwise.
 */
export function showAnnouncement(): void {
  if (!activeController) {
    console.warn(
      '[Mite] showAnnouncement() called without a mounted <AnnouncementPopup /> component. Render <AnnouncementPopup /> inside your MiteProvider first.',
    )
    return
  }

  activeController()
}

/**
 * In-app announcement popup. Automatically shows the latest active
 * announcement once per device, and can be re-opened on demand with
 * showAnnouncement(). Announcements are created and published from the Mite
 * dashboard and can change content or expire at any time — no app release
 * needed.
 */
export function AnnouncementPopup({
  dismissLabel,
  onDismiss,
  onCtaPress,
  ...options
}: AnnouncementPopupProps) {
  const { visible, announcement, show, dismiss } = useAnnouncementPopup(options)
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

  const handleCtaPress = () => {
    if (!announcement?.ctaUrl) {
      return
    }
    onCtaPress?.(announcement.ctaUrl)
    Linking.openURL(announcement.ctaUrl).catch(err => {
      console.warn('[Mite] Failed to open announcement URL:', err)
    })
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor }]}>
          {announcement && (
            <>
              <Text style={[styles.title, { color }]}>{announcement.title}</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {announcement.content ? (
                  <MarkdownText
                    markdown={announcement.content}
                    color={color}
                    codeBackgroundColor={codeBackgroundColor}
                  />
                ) : (
                  <Text style={[styles.emptyContent, { color: mutedColor }]}>
                    Nothing else to add.
                  </Text>
                )}
              </ScrollView>
              {announcement.ctaUrl && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={announcement.ctaLabel ?? 'Learn more'}
                  style={[styles.ctaButton, { backgroundColor: buttonColor }]}
                  onPress={handleCtaPress}
                >
                  <Text style={styles.ctaText}>
                    {announcement.ctaLabel ?? 'Learn more'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={dismissLabel ?? 'Got it'}
                style={styles.dismissButton}
                onPress={handleDismiss}
              >
                <Text style={[styles.dismissText, { color: mutedColor }]}>
                  {dismissLabel ?? 'Got it'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
  },
  emptyContent: {
    fontSize: 15,
  },
  ctaButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
})
