import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { InputWithLabel } from '@/components/ui/InputWithLabel'
import { useThemeColor } from '@/hooks/useThemeColor'
import { useBugReport } from '@mite/mite-sdk'
import { useState } from 'react'
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

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export default function ReportScreen() {
  const insets = useSafeAreaInsets()
  const { submitBug, submitting, lastResponse, reset } = useBugReport()
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#4fc3f7' }, 'tint')
  const cardBg = useThemeColor({ light: '#f5f5f5', dark: '#1e1e1e' }, 'background')
  const chipBg = useThemeColor({ light: '#e8e8e8', dark: '#2a2a2a' }, 'background')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    'MEDIUM',
  )
  const [stepsToReproduce, setStepsToReproduce] = useState('')

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Title and description are required.')
      return
    }

    try {
      await submitBug({
        title: title.trim(),
        description: description.trim(),
        priority,
        steps_to_reproduce: stepsToReproduce.trim() || undefined,
      })
      Alert.alert('Bug reported!', 'Your report has been submitted.', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('')
            setDescription('')
            setPriority('MEDIUM')
            setStepsToReproduce('')
            reset()
          },
        },
      ])
    } catch {
      Alert.alert('Error', 'Failed to submit. Please try again.')
    }
  }

  if (lastResponse) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.successContainer, { paddingTop: insets.top + 20 }]}>
          <View style={[styles.successBadge, { backgroundColor: '#34c75920' }]}>
            <ThemedText style={styles.successIcon}>✓</ThemedText>
          </View>
          <ThemedText type="title">Submitted</ThemedText>
          <ThemedText lightColor="#666" darkColor="#999">
            Bug ID: {lastResponse.id}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => {
              setTitle('')
              setDescription('')
              setPriority('MEDIUM')
              setStepsToReproduce('')
              reset()
            }}
          >
            <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
              Report Another
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    )
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
          <ThemedText type="title" style={styles.pageTitle}>
            Report a Bug
          </ThemedText>
          <ThemedText style={styles.pageSubtitle} lightColor="#666" darkColor="#999">
            Help us improve by reporting issues
          </ThemedText>

          <View style={styles.form}>
            <InputWithLabel
              label="Title"
              required
              placeholder="Brief summary of the issue"
              value={title}
              onChangeText={setTitle}
            />

            <InputWithLabel
              label="Description"
              required
              placeholder="What happened?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />

            <View style={styles.fieldContainer}>
              <ThemedText style={styles.label}>Priority</ThemedText>
              <View style={styles.chipRow}>
                {PRIORITIES.map(p => {
                  const isSelected = priority === p
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? tintColor : chipBg,
                        },
                      ]}
                    >
                      <ThemedText
                        style={styles.chipText}
                        lightColor={isSelected ? '#fff' : '#666'}
                        darkColor={isSelected ? '#fff' : '#999'}
                      >
                        {p}
                      </ThemedText>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <InputWithLabel
              label="Steps to Reproduce"
              placeholder="1. Go to...&#10;2. Tap on...&#10;3. See error"
              value={stepsToReproduce}
              onChangeText={setStepsToReproduce}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: tintColor },
                submitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
                  Submit Report
                </ThemedText>
              )}
            </TouchableOpacity>
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
    paddingBottom: 100,
  },
  pageTitle: {
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  form: {
    gap: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successIcon: {
    fontSize: 28,
    color: '#34c759',
    fontWeight: 'bold',
  },
})
