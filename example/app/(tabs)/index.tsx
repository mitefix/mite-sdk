import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { IconSymbol } from '@/components/ui/IconSymbol'
import type { IconSymbolName } from '@/components/ui/IconSymbol'
import { useThemeColor } from '@/hooks/useThemeColor'
import { StoreReviewPrompt, useMite } from '@usemite/mite-sdk'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: IconSymbolName
  title: string
  description: string
}) {
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#1e1e1e' }, 'background')
  const iconColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <IconSymbol name={icon} size={28} color={iconColor} style={styles.cardIcon} />
      <View style={styles.cardContent}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText style={styles.cardDescription} lightColor="#666" darkColor="#999">
          {description}
        </ThemedText>
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const mite = useMite()
  const insets = useSafeAreaInsets()
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')
  const [reviewPromptVisible, setReviewPromptVisible] = useState(false)

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logoBadge, { backgroundColor: `${tintColor}15` }]}>
            <IconSymbol name="ladybug.fill" size={32} color={tintColor} />
          </View>
          <ThemedText type="title" style={styles.title}>
            Mite SDK
          </ThemedText>
          <ThemedText style={styles.subtitle} lightColor="#666" darkColor="#999">
            Bug reporting & release management
          </ThemedText>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <ThemedText style={styles.statusText} lightColor="#666" darkColor="#999">
            SDK initialized
          </ThemedText>
          <ThemedText style={styles.statusText} lightColor="#999" darkColor="#666">
            {' · '}
            {mite.pendingRequestCount} pending
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="defaultSemiBold"
            style={styles.sectionTitle}
            lightColor="#999"
            darkColor="#666"
          >
            FEATURES
          </ThemedText>
          <FeatureCard
            icon="ant.fill"
            title="Bug Reports"
            description="Submit bug reports with attachments and device info. Try it in the Report tab."
          />
          <FeatureCard
            icon="shippingbox.fill"
            title="Releases"
            description="Browse your app's version history and release notes."
          />
          <FeatureCard
            icon="lightbulb.fill"
            title="Feature Requests"
            description="Create requests, review the board, and toggle votes from the example app."
          />
          <FeatureCard
            icon="person.fill"
            title="User Identification"
            description="Identify users to associate reports and votes with accounts. Try it in the Profile tab."
          />
          <Pressable
            onPress={async () => {
              await mite.flushOfflineQueue()
              Alert.alert(
                'Offline queue flushed',
                `${mite.pendingRequestCount} request(s) still pending.`,
              )
            }}
          >
            <FeatureCard
              icon="wifi.slash"
              title="Offline Queue"
              description="Requests are queued when offline and sent when connectivity returns. Tap to flush the queue."
            />
          </Pressable>
          <Pressable onPress={() => setReviewPromptVisible(true)}>
            <FeatureCard
              icon="star.fill"
              title="Store Review Prompt"
              description="Deflection prompt: happy users rate the app, unhappy users send feedback. Tap to try it."
            />
          </Pressable>
        </View>
      </ScrollView>

      <StoreReviewPrompt
        visible={reviewPromptVisible}
        onClose={() => setReviewPromptVisible(false)}
        onPositive={reviewRequested => {
          if (!reviewRequested) {
            Alert.alert(
              'Store review unavailable',
              'The native review dialog could not be requested on this device.',
            )
          }
        }}
        onFeedbackSubmitted={() => {
          Alert.alert('Thanks!', 'Your feedback was submitted to Mite.')
        }}
      />
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34c759',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
})
