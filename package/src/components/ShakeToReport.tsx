import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMite } from '../MiteProvider'
import { ShakeDetector, type ShakeDetectorOptions } from '../ShakeDetector'
import type { SubmitBugReportResponse } from '../types'
import { loadViewShot } from '../utils/optionalModules'
import { ScreenshotAnnotator } from './ScreenshotAnnotator'

type ReportStep = 'idle' | 'annotate' | 'form'
type ReportTrigger = 'shake' | 'button'

export interface ShakeToReportProps {
  /**
   * Listen for shake gestures to open the report flow. Requires expo-sensors.
   * @default true
   */
  shakeEnabled?: boolean
  /**
   * Render a floating bug button as an alternative trigger.
   * @default false
   */
  showFloatingButton?: boolean
  /**
   * Capture a screenshot when the flow opens. Requires react-native-view-shot.
   * @default true
   */
  screenshotEnabled?: boolean
  /**
   * Shake sensitivity and timing overrides passed to the shake detector.
   */
  shakeOptions?: Omit<ShakeDetectorOptions, 'accelerometerModule'>
  /**
   * Called after a bug report is submitted successfully.
   */
  onSubmitted?: (response: SubmitBugReportResponse) => void
  /**
   * Called when submitting the bug report fails.
   */
  onError?: (error: Error) => void
}

function buildEnvironment(trigger: ReportTrigger): Record<string, unknown> {
  const window = Dimensions.get('window')

  return {
    source: 'shake-to-report',
    trigger,
    platform: Platform.OS,
    os_version: String(Platform.Version),
    screen_width: Math.round(window.width),
    screen_height: Math.round(window.height),
    pixel_ratio: PixelRatio.get(),
    font_scale: PixelRatio.getFontScale(),
  }
}

/**
 * In-app bug reporting overlay. Opens on a shake gesture (expo-sensors) or a
 * floating trigger button, captures a screenshot (react-native-view-shot),
 * lets the user annotate it, and submits the report with device context.
 * Mount once anywhere inside MiteProvider.
 */
export function ShakeToReport({
  shakeEnabled = true,
  showFloatingButton = false,
  screenshotEnabled = true,
  shakeOptions,
  onSubmitted,
  onError,
}: ShakeToReportProps) {
  const mite = useMite()

  const [step, setStep] = useState<ReportStep>('idle')
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const stepRef = useRef<ReportStep>('idle')
  const triggerRef = useRef<ReportTrigger>('shake')
  const shakeOptionsRef = useRef(shakeOptions)

  stepRef.current = step
  shakeOptionsRef.current = shakeOptions

  const openReport = useCallback(
    async (trigger: ReportTrigger) => {
      if (stepRef.current !== 'idle') {
        return
      }

      triggerRef.current = trigger
      let uri: string | null = null

      if (screenshotEnabled) {
        const viewShot = loadViewShot()
        if (viewShot) {
          try {
            uri = await viewShot.captureScreen({
              format: 'jpg',
              quality: 0.9,
              result: 'tmpfile',
            })
          } catch (err) {
            console.warn('[Mite] Screenshot capture failed:', err)
          }
        }
      }

      setScreenshotUri(uri)
      setStep(uri ? 'annotate' : 'form')
    },
    [screenshotEnabled],
  )

  useEffect(() => {
    if (!shakeEnabled) {
      return
    }

    const detector = new ShakeDetector(shakeOptionsRef.current)
    detector.start(() => {
      void openReport('shake')
    })

    return () => {
      detector.stop()
    }
  }, [shakeEnabled, openReport])

  const closeReport = useCallback(() => {
    setStep('idle')
    setScreenshotUri(null)
    setTitle('')
    setDescription('')
    setSubmitError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return
    }

    if (!title.trim() || !description.trim()) {
      setSubmitError('Title and description are required.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await mite.submitBug({
        title: title.trim(),
        description: description.trim(),
        environment: buildEnvironment(triggerRef.current),
        ...(screenshotUri
          ? {
              attachments: [
                {
                  uri: screenshotUri,
                  type: 'image/jpeg',
                  name: 'screenshot.jpg',
                },
              ],
            }
          : {}),
      })
      closeReport()
      onSubmitted?.(response)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit bug report')
      setSubmitError('Failed to submit. Please try again.')
      onError?.(error)
    } finally {
      setSubmitting(false)
    }
  }, [
    closeReport,
    description,
    mite,
    onError,
    onSubmitted,
    screenshotUri,
    submitting,
    title,
  ])

  return (
    <>
      {showFloatingButton && step === 'idle' ? (
        <Pressable
          accessibilityLabel="Report a bug"
          accessibilityRole="button"
          onPress={() => void openReport('button')}
          style={styles.floatingButton}
        >
          <Text style={styles.floatingButtonText}>🐞</Text>
        </Pressable>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={closeReport}
        presentationStyle="fullScreen"
        visible={step !== 'idle'}
      >
        {step === 'annotate' && screenshotUri ? (
          <ScreenshotAnnotator
            imageUri={screenshotUri}
            onCancel={closeReport}
            onDone={annotatedUri => {
              setScreenshotUri(annotatedUri)
              setStep('form')
            }}
          />
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={closeReport}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonText}>Cancel</Text>
              </Pressable>
              <Text style={styles.formTitle}>Report a Bug</Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {screenshotUri ? (
                <Pressable
                  accessibilityLabel="Edit screenshot"
                  accessibilityRole="button"
                  onPress={() => setStep('annotate')}
                  style={styles.thumbnailWrapper}
                >
                  <Image
                    resizeMode="cover"
                    source={{ uri: screenshotUri }}
                    style={styles.thumbnail}
                  />
                  <Text style={styles.thumbnailHint}>Tap to edit</Text>
                </Pressable>
              ) : null}

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                onChangeText={setTitle}
                placeholder="Brief summary of the issue"
                placeholderTextColor="#8A8F98"
                style={styles.input}
                value={title}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                multiline
                numberOfLines={4}
                onChangeText={setDescription}
                placeholder="What happened?"
                placeholderTextColor="#8A8F98"
                style={[styles.input, styles.textArea]}
                value={description}
              />

              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void handleSubmit()}
                style={[styles.submitButton, submitting && styles.submitDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16181D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#0B0C0F',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 64,
  },
  headerButtonText: {
    color: '#E7E9EE',
    fontSize: 16,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 8,
  },
  thumbnailWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  thumbnail: {
    width: 96,
    height: 170,
    borderRadius: 10,
    backgroundColor: '#1D2027',
  },
  thumbnailHint: {
    color: '#8A8F98',
    fontSize: 12,
    marginTop: 6,
  },
  inputLabel: {
    color: '#E7E9EE',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#16181D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262A33',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#3D6DEB',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
