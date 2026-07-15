import { useCallback, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMite } from '../MiteProvider'
import type { SubmitBugReportResponse } from '../types'

export interface StoreReviewPromptProps {
  /** Controls the visibility of the prompt. */
  visible: boolean
  /** Called whenever the prompt should be dismissed. */
  onClose: () => void
  /** Heading of the initial question. @default 'Enjoying the app?' */
  title?: string
  /** Supporting text under the heading. */
  message?: string
  /** Label for the positive answer. @default 'Yes, I love it!' */
  positiveText?: string
  /** Label for the negative answer. @default 'Not really' */
  negativeText?: string
  /** Heading of the built-in feedback step. @default 'What could be better?' */
  feedbackTitle?: string
  /** Placeholder of the feedback input. @default 'Tell us what went wrong...' */
  feedbackPlaceholder?: string
  /** Label for the feedback submit button. @default 'Send feedback' */
  feedbackSubmitText?: string
  /** Label for the dismiss buttons. @default 'Not now' */
  dismissText?: string
  /** Title used for the bug report created from the feedback step. @default 'In-app feedback' */
  feedbackReportTitle?: string
  /**
   * Called after a positive answer. `reviewRequested` is false when the
   * optional expo-store-review dependency is missing or unavailable.
   */
  onPositive?: (reviewRequested: boolean) => void
  /**
   * Called on a negative answer. When provided, the built-in feedback step is
   * skipped so you can route the user into your own bug/feedback flow.
   */
  onNegative?: () => void
  /** Called after feedback from the built-in step was submitted. */
  onFeedbackSubmitted?: (response: SubmitBugReportResponse) => void
}

type PromptStep = 'ask' | 'feedback'

/**
 * Store-review deflection prompt. Asks "Enjoying the app?" — happy users are
 * routed to the native store review dialog (via the optional expo-store-review
 * dependency), unhappy users are routed into a Mite feedback form instead.
 */
export function StoreReviewPrompt({
  visible,
  onClose,
  title = 'Enjoying the app?',
  message = 'Your feedback helps us improve.',
  positiveText = 'Yes, I love it!',
  negativeText = 'Not really',
  feedbackTitle = 'What could be better?',
  feedbackPlaceholder = 'Tell us what went wrong...',
  feedbackSubmitText = 'Send feedback',
  dismissText = 'Not now',
  feedbackReportTitle = 'In-app feedback',
  onPositive,
  onNegative,
  onFeedbackSubmitted,
}: StoreReviewPromptProps) {
  const mite = useMite()
  const [step, setStep] = useState<PromptStep>('ask')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setStep('ask')
    setFeedback('')
    setSubmitting(false)
    setError(null)
    onClose()
  }, [onClose])

  const handlePositive = useCallback(async () => {
    handleClose()
    const reviewRequested = await mite.requestStoreReview()
    onPositive?.(reviewRequested)
  }, [handleClose, mite, onPositive])

  const handleNegative = useCallback(() => {
    if (onNegative) {
      handleClose()
      onNegative()
      return
    }

    setStep('feedback')
  }, [handleClose, onNegative])

  const handleSubmitFeedback = useCallback(async () => {
    const description = feedback.trim()

    if (!description || submitting) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await mite.submitBug({
        title: feedbackReportTitle,
        description,
      })
      handleClose()
      onFeedbackSubmitted?.(response)
    } catch (err) {
      console.warn('[Mite] Failed to submit store review prompt feedback:', err)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }, [feedback, feedbackReportTitle, handleClose, mite, onFeedbackSubmitted, submitting])

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {step === 'ask' ? (
            <>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <Pressable
                style={[styles.button, styles.primaryButton]}
                onPress={handlePositive}
              >
                <Text style={styles.primaryButtonText}>{positiveText}</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={handleNegative}
              >
                <Text style={styles.secondaryButtonText}>{negativeText}</Text>
              </Pressable>
              <Pressable style={styles.dismissButton} onPress={handleClose}>
                <Text style={styles.dismissText}>{dismissText}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{feedbackTitle}</Text>
              <TextInput
                multiline
                style={styles.input}
                value={feedback}
                onChangeText={setFeedback}
                placeholder={feedbackPlaceholder}
                placeholderTextColor="#999"
                editable={!submitting}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={[
                  styles.button,
                  styles.primaryButton,
                  (!feedback.trim() || submitting) && styles.disabledButton,
                ]}
                disabled={!feedback.trim() || submitting}
                onPress={handleSubmitFeedback}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? 'Sending...' : feedbackSubmitText}
                </Text>
              </Pressable>
              <Pressable style={styles.dismissButton} onPress={handleClose}>
                <Text style={styles.dismissText}>{dismissText}</Text>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 4,
  },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111',
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    color: '#d32f2f',
    textAlign: 'center',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#111',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#f2f2f2',
  },
  secondaryButtonText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.5,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dismissText: {
    color: '#999',
    fontSize: 14,
  },
})
