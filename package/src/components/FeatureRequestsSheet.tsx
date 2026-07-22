import { type PropsWithChildren, useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { FeatureRequest, FeatureRequestStatus } from '../types'
import { useFeatureRequests } from '../useFeatureRequests'

const DEFAULT_ACCENT_COLOR = '#0a7ea4'

const STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
}

const STATUS_COLORS: Record<FeatureRequestStatus, string> = {
  OPEN: '#0a7ea4',
  IN_PROGRESS: '#ff9500',
  COMPLETED: '#34c759',
  CLOSED: '#8e8e93',
}

export interface FeatureRequestsSheetProps {
  /** Sheet title. Defaults to "Feature requests". */
  title?: string
  /** Accent color for buttons and the active vote state. */
  accentColor?: string
  /** Called after a feature request is submitted successfully. */
  onSubmitted?: (featureRequestId: string) => void
}

interface SheetHeaderProps {
  title: string
  onClose: () => void
}

function SheetHeader({ title, onClose }: SheetHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={onClose}
      >
        <Text style={styles.headerClose}>Close</Text>
      </Pressable>
    </View>
  )
}

function StatusBadge({ status }: { status: FeatureRequestStatus }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[status]}20` }]}>
      <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  )
}

interface VoteButtonProps {
  voteCount: number
  hasVoted: boolean
  voting: boolean
  accentColor: string
  onPress: () => void
}

function VoteButton({
  voteCount,
  hasVoted,
  voting,
  accentColor,
  onPress,
}: VoteButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasVoted ? 'Remove vote' : 'Vote'}
      accessibilityState={{ selected: hasVoted, disabled: voting }}
      style={[
        styles.voteButton,
        hasVoted && { backgroundColor: `${accentColor}1a`, borderColor: accentColor },
        voting && styles.disabled,
      ]}
      disabled={voting}
      onPress={onPress}
    >
      {voting ? (
        <ActivityIndicator size="small" color={accentColor} />
      ) : (
        <>
          <Text style={[styles.voteArrow, hasVoted && { color: accentColor }]}>▲</Text>
          <Text style={[styles.voteCount, hasVoted && { color: accentColor }]}>
            {voteCount}
          </Text>
        </>
      )}
    </Pressable>
  )
}

interface FeatureRequestRowProps {
  request: FeatureRequest
  hasVoted: boolean
  voting: boolean
  accentColor: string
  onVote: (featureRequestId: string) => void
}

function FeatureRequestRow({
  request,
  hasVoted,
  voting,
  accentColor,
  onVote,
}: FeatureRequestRowProps) {
  return (
    <View style={styles.row}>
      <VoteButton
        voteCount={request.voteCount}
        hasVoted={hasVoted}
        voting={voting}
        accentColor={accentColor}
        onPress={() => onVote(request.id)}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {request.title}
          </Text>
          <StatusBadge status={request.status} />
        </View>
        {request.description ? (
          <Text style={styles.rowDescription} numberOfLines={3}>
            {request.description}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

interface ComposeFormProps {
  accentColor: string
  submitting: boolean
  submitError: Error | null
  onSubmit: (input: {
    title: string
    description?: string
    author_email: string
  }) => void
  onCancel: () => void
}

function ComposeForm({
  accentColor,
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: ComposeFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const canSubmit = title.trim().length > 0 && email.trim().includes('@') && !submitting

  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="What would you like to see?"
        placeholderTextColor="#8e8e93"
        value={title}
        onChangeText={setTitle}
        editable={!submitting}
      />
      <Text style={styles.formLabel}>Details (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Tell us more about it"
        placeholderTextColor="#8e8e93"
        value={description}
        onChangeText={setDescription}
        editable={!submitting}
        multiline
        numberOfLines={4}
      />
      <Text style={styles.formLabel}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor="#8e8e93"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {submitError ? (
        <Text style={styles.errorText}>
          Could not submit your request. Please try again.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        style={[
          styles.primaryButton,
          { backgroundColor: accentColor },
          !canSubmit && styles.disabled,
        ]}
        disabled={!canSubmit}
        onPress={() =>
          onSubmit({
            title,
            ...(description.trim() ? { description } : {}),
            author_email: email,
          })
        }
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>Submit request</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={styles.secondaryButton}
        disabled={submitting}
        onPress={onCancel}
      >
        <Text style={styles.secondaryButtonText}>Back to list</Text>
      </Pressable>
    </View>
  )
}

/**
 * In-app sheet where end users can browse existing feature requests, vote on
 * them, and submit new ones. Votes are tied to the SDK's identified/anonymous
 * end user; submissions require an email so the team can follow up.
 *
 * Wrap any element to use it as the trigger:
 *
 * ```tsx
 * <FeatureRequestsSheet>
 *   <Text>Request a feature</Text>
 * </FeatureRequestsSheet>
 * ```
 */
export function FeatureRequestsSheet({
  children,
  title = 'Feature requests',
  accentColor = DEFAULT_ACCENT_COLOR,
  onSubmitted,
}: PropsWithChildren<FeatureRequestsSheetProps>) {
  const [visible, setVisible] = useState(false)
  const [composing, setComposing] = useState(false)
  const {
    featureRequests,
    votedFeatureRequestIds,
    loading,
    error,
    refetch,
    submitFeatureRequest,
    submitting,
    submitError,
    toggleVote,
    votingFeatureRequestIds,
  } = useFeatureRequests({ enabled: visible })

  const close = useCallback(() => {
    setVisible(false)
    setComposing(false)
  }, [])

  const handleVote = useCallback(
    (featureRequestId: string) => {
      toggleVote(featureRequestId).catch(() => {
        // The hook reverts optimistic state and logs the failure.
      })
    },
    [toggleVote],
  )

  const handleSubmit = useCallback(
    (input: {
      title: string
      description?: string
      author_email: string
    }) => {
      submitFeatureRequest(input)
        .then(response => {
          setComposing(false)
          onSubmitted?.(response.id)
        })
        .catch(() => {
          // The hook stores submitError and logs the failure.
        })
    },
    [submitFeatureRequest, onSubmitted],
  )

  return (
    <>
      <Pressable onPress={() => setVisible(true)}>{children}</Pressable>
      <Modal
        presentationStyle="pageSheet"
        visible={visible}
        onRequestClose={close}
        onDismiss={close}
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <SheetHeader title={title} onClose={close} />

          {composing ? (
            <ComposeForm
              accentColor={accentColor}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmit}
              onCancel={() => setComposing(false)}
            />
          ) : (
            <>
              {loading && featureRequests.length === 0 ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={accentColor} />
                </View>
              ) : error ? (
                <View style={styles.centered}>
                  <Text style={styles.errorText}>Could not load feature requests.</Text>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.primaryButton, { backgroundColor: accentColor }]}
                    onPress={() => {
                      void refetch()
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              ) : featureRequests.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyTitle}>No requests yet</Text>
                  <Text style={styles.emptyText}>Be the first to suggest a feature.</Text>
                </View>
              ) : (
                <FlatList
                  data={featureRequests}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <FeatureRequestRow
                      request={item}
                      hasVoted={votedFeatureRequestIds.includes(item.id)}
                      voting={votingFeatureRequestIds.includes(item.id)}
                      accentColor={accentColor}
                      onVote={handleVote}
                    />
                  )}
                />
              )}

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.primaryButton, { backgroundColor: accentColor }]}
                  onPress={() => setComposing(true)}
                >
                  <Text style={styles.primaryButtonText}>Suggest a feature</Text>
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d1d6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },
  headerClose: {
    fontSize: 16,
    color: '#8e8e93',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#c62828',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  emptyText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
  listContent: {
    padding: 18,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  rowContent: {
    flex: 1,
    gap: 6,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#555555',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  voteButton: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  voteArrow: {
    fontSize: 12,
    color: '#8e8e93',
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  footer: {
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d1d6',
  },
  form: {
    padding: 18,
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#ffffff',
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#8e8e93',
  },
  disabled: {
    opacity: 0.6,
  },
})
