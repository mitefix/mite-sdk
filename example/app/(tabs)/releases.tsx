import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { useThemeColor } from '@/hooks/useThemeColor'
import { type Release, useReleases } from '@mite/mite-sdk'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const PLATFORM_COLORS: Record<string, string> = {
  ios: '#007AFF',
  android: '#34c759',
  all: '#8E44AD',
}

const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  all: 'All Platforms',
}

function formatDate(timestamp?: number) {
  if (!timestamp) return 'Draft'
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ReleaseCard({ release }: { release: Release }) {
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#1e1e1e' }, 'background')
  const platformColor = PLATFORM_COLORS[release.platform] ?? '#666'

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.cardHeader}>
        <ThemedText type="defaultSemiBold" style={styles.version}>
          v{release.version}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: platformColor }]}>
          <ThemedText style={styles.badgeText} lightColor="#fff" darkColor="#fff">
            {PLATFORM_LABELS[release.platform] ?? release.platform}
          </ThemedText>
        </View>
      </View>
      {release.notes && (
        <ThemedText style={styles.notes} lightColor="#444" darkColor="#bbb">
          {release.notes}
        </ThemedText>
      )}
      <ThemedText style={styles.date} lightColor="#999" darkColor="#666">
        {formatDate(release.releasedAt)}
      </ThemedText>
    </View>
  )
}

export default function ReleasesScreen() {
  const insets = useSafeAreaInsets()
  const { releases, loading, error, refetch } = useReleases({ limit: 10 })
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')
  const errorBg = useThemeColor({ light: '#FFEBEE', dark: '#3b1a1a' }, 'background')

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <ThemedText type="title">Releases</ThemedText>
            <ThemedText style={styles.subtitle} lightColor="#666" darkColor="#999">
              App version history
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: tintColor }]}
            onPress={refetch}
            disabled={loading}
          >
            <ThemedText style={styles.refreshText} lightColor="#fff" darkColor="#fff">
              Refresh
            </ThemedText>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={styles.loadingText} lightColor="#666" darkColor="#999">
              Loading releases...
            </ThemedText>
          </View>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: errorBg }]}>
            <ThemedText style={styles.errorText} lightColor="#C62828" darkColor="#ef5350">
              {error.message}
            </ThemedText>
            <TouchableOpacity style={styles.retryButton} onPress={refetch}>
              <ThemedText style={styles.retryText} lightColor="#fff" darkColor="#fff">
                Retry
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && releases.length === 0 && (
          <View style={styles.centered}>
            <ThemedText type="defaultSemiBold" lightColor="#666" darkColor="#999">
              No releases found
            </ThemedText>
            <ThemedText style={styles.emptySubtext} lightColor="#999" darkColor="#666">
              Check that your API key is configured correctly
            </ThemedText>
          </View>
        )}

        {!loading && (
          <View style={styles.list}>
            {releases.map(release => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#C62828',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  version: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
  },
})
