import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { InputWithLabel } from '@/components/ui/InputWithLabel'
import { useThemeColor } from '@/hooks/useThemeColor'
import { type FeatureRequest, useFeatureRequests, useMite } from '@mite/mite-sdk'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const STATUS_LABELS: Record<FeatureRequest['status'], string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
}

const STATUS_COLORS: Record<FeatureRequest['status'], string> = {
  OPEN: '#0a7ea4',
  IN_PROGRESS: '#ff9500',
  COMPLETED: '#34c759',
  CLOSED: '#8e8e93',
}

function formatCreatedAt(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FeatureRequestCard({
  request,
  hasVoted,
  voterEmail,
  voting,
  onVote,
}: {
  request: FeatureRequest
  hasVoted: boolean
  voterEmail: string
  voting: boolean
  onVote: (requestId: string) => Promise<void>
}) {
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#1e1e1e' }, 'background')
  const mutedText = useThemeColor({ light: '#666', dark: '#999' }, 'text')
  const voteBg = useThemeColor({ light: '#e9f6fb', dark: '#183743' }, 'background')
  const voteIdleBg = useThemeColor({ light: '#ececec', dark: '#292929' }, 'background')
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <ThemedText type="defaultSemiBold">{request.title}</ThemedText>
          <ThemedText
            style={styles.metaText}
            lightColor={mutedText}
            darkColor={mutedText}
          >
            {request.authorName} · {formatCreatedAt(request.createdAt)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${STATUS_COLORS[request.status]}20` },
          ]}
        >
          <ThemedText
            style={[styles.statusText, { color: STATUS_COLORS[request.status] }]}
          >
            {STATUS_LABELS[request.status]}
          </ThemedText>
        </View>
      </View>

      {request.description ? (
        <ThemedText style={styles.description} lightColor="#444" darkColor="#bbb">
          {request.description}
        </ThemedText>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.voteMeta}>
          <ThemedText type="defaultSemiBold">{request.voteCount}</ThemedText>
          <ThemedText
            style={styles.metaText}
            lightColor={mutedText}
            darkColor={mutedText}
          >
            vote{request.voteCount === 1 ? '' : 's'}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.voteButton,
            { backgroundColor: hasVoted ? voteBg : voteIdleBg },
            voting && styles.buttonDisabled,
          ]}
          onPress={() => onVote(request.id)}
          disabled={voting}
        >
          {voting ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : (
            <ThemedText
              style={[styles.voteButtonText, { color: hasVoted ? tintColor : mutedText }]}
            >
              {hasVoted ? 'Undo vote' : voterEmail ? 'Vote' : 'Vote by email'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function FeatureRequestsScreen() {
  const mite = useMite()
  const insets = useSafeAreaInsets()
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')
  const errorBg = useThemeColor({ light: '#FFEBEE', dark: '#3b1a1a' }, 'background')

  const [voterEmail, setVoterEmail] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null)

  const normalizedVoterEmail = useMemo(
    () => voterEmail.trim().toLowerCase(),
    [voterEmail],
  )

  const { featureRequests, votedFeatureRequestIds, loading, error, refetch } =
    useFeatureRequests({
      enabled: true,
      voterEmail: normalizedVoterEmail || undefined,
    })

  const votedSet = useMemo(
    () => new Set(votedFeatureRequestIds),
    [votedFeatureRequestIds],
  )

  const handleCreate = async () => {
    if (!title.trim() || !authorName.trim() || !authorEmail.trim()) {
      Alert.alert('Missing fields', 'Name, email, and title are required.')
      return
    }

    setSubmitting(true)
    try {
      await mite.createFeatureRequest({
        title,
        description,
        author_name: authorName,
        author_email: authorEmail,
      })
      setTitle('')
      setDescription('')
      if (!normalizedVoterEmail) {
        setVoterEmail(authorEmail.trim().toLowerCase())
      }
      await refetch()
      Alert.alert('Request submitted', 'Your feature request is now on the board.')
    } catch {
      Alert.alert('Error', 'Failed to create feature request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (requestId: string) => {
    if (!normalizedVoterEmail) {
      Alert.alert('Email required', 'Enter your email above before voting.')
      return
    }

    setVotingRequestId(requestId)
    try {
      await mite.voteFeatureRequest({
        feature_request_id: requestId,
        voter_email: normalizedVoterEmail,
      })
      await refetch()
    } catch {
      Alert.alert('Error', 'Failed to update your vote. Please try again.')
    } finally {
      setVotingRequestId(null)
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View>
              <ThemedText type="title">Feature Requests</ThemedText>
              <ThemedText style={styles.subtitle} lightColor="#666" darkColor="#999">
                Create ideas and vote on the roadmap.
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

          <View style={styles.section}>
            <ThemedText type="defaultSemiBold">Voting identity</ThemedText>
            <InputWithLabel
              label="Voter email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={voterEmail}
              onChangeText={setVoterEmail}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="defaultSemiBold">Submit a feature request</ThemedText>
            <InputWithLabel
              label="Your name"
              required
              placeholder="Taylor"
              value={authorName}
              onChangeText={setAuthorName}
            />
            <InputWithLabel
              label="Your email"
              required
              placeholder="taylor@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={authorEmail}
              onChangeText={setAuthorEmail}
            />
            <InputWithLabel
              label="Title"
              required
              placeholder="Offline mode"
              value={title}
              onChangeText={setTitle}
            />
            <InputWithLabel
              label="Description"
              placeholder="Let users keep working with cached content and sync later."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: tintColor },
                submitting && styles.buttonDisabled,
              ]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText
                  style={styles.primaryButtonText}
                  lightColor="#fff"
                  darkColor="#fff"
                >
                  Submit request
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <ThemedText type="defaultSemiBold">Board</ThemedText>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={tintColor} />
                <ThemedText style={styles.helperText} lightColor="#666" darkColor="#999">
                  Loading feature requests...
                </ThemedText>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: errorBg }]}>
                <ThemedText
                  style={styles.errorText}
                  lightColor="#C62828"
                  darkColor="#ef5350"
                >
                  {error.message}
                </ThemedText>
              </View>
            ) : null}

            {!loading && !error && featureRequests.length === 0 ? (
              <View style={styles.centered}>
                <ThemedText type="defaultSemiBold">No requests yet</ThemedText>
                <ThemedText style={styles.helperText} lightColor="#666" darkColor="#999">
                  Submit the first idea to populate the board.
                </ThemedText>
              </View>
            ) : null}

            {!loading && !error ? (
              <View style={styles.list}>
                {featureRequests.map(request => (
                  <FeatureRequestCard
                    key={request.id}
                    request={request}
                    hasVoted={votedSet.has(request.id)}
                    voterEmail={normalizedVoterEmail}
                    voting={votingRequestId === request.id}
                    onVote={handleVote}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
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
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  centered: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  helperText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    gap: 12,
    marginTop: 12,
  },
  card: {
    padding: 16,
    borderRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  voteMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  voteButton: {
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
