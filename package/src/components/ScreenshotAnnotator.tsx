import { useCallback, useRef, useState } from 'react'
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { loadViewShot } from '../utils/optionalModules'

interface Point {
  id: number
  x: number
  y: number
}

interface StrokeAnnotation {
  id: number
  kind: 'stroke'
  points: Point[]
}

interface RectAnnotation {
  id: number
  kind: 'rect'
  startX: number
  startY: number
  endX: number
  endY: number
}

let nextAnnotationId = 0

function newId(): number {
  nextAnnotationId += 1
  return nextAnnotationId
}

type Annotation = StrokeAnnotation | RectAnnotation

type AnnotationTool = 'pen' | 'blur'

const PEN_COLOR = '#FF3B30'
const PEN_WIDTH = 5
const BLUR_COLOR = '#16181D'
const MAX_STROKE_POINTS = 1500

export interface ScreenshotAnnotatorProps {
  /** Local URI of the screenshot to annotate. */
  imageUri: string
  /** Called with the flattened image URI when the user finishes annotating. */
  onDone: (annotatedUri: string) => void
  /** Called when the user cancels annotation. */
  onCancel: () => void
}

function appendInterpolated(points: Point[], x: number, y: number): Point[] {
  const next: Point = { id: newId(), x, y }
  const last = points[points.length - 1]
  if (!last) {
    return [next]
  }

  const dx = next.x - last.x
  const dy = next.y - last.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const step = PEN_WIDTH / 2
  const updated = points.slice()

  if (distance > step) {
    const segments = Math.min(Math.floor(distance / step), 24)
    for (let i = 1; i < segments; i++) {
      updated.push({
        id: newId(),
        x: last.x + (dx * i) / segments,
        y: last.y + (dy * i) / segments,
      })
    }
  }

  updated.push(next)
  return updated.length > MAX_STROKE_POINTS
    ? updated.slice(updated.length - MAX_STROKE_POINTS)
    : updated
}

function renderAnnotation(annotation: Annotation) {
  if (annotation.kind === 'rect') {
    const left = Math.min(annotation.startX, annotation.endX)
    const top = Math.min(annotation.startY, annotation.endY)
    const width = Math.abs(annotation.endX - annotation.startX)
    const height = Math.abs(annotation.endY - annotation.startY)

    return (
      <View
        key={`rect-${annotation.id}`}
        pointerEvents="none"
        style={[styles.redactRect, { left, top, width, height }]}
      />
    )
  }

  return annotation.points.map(point => (
    <View
      key={`point-${point.id}`}
      pointerEvents="none"
      style={[
        styles.penDot,
        { left: point.x - PEN_WIDTH / 2, top: point.y - PEN_WIDTH / 2 },
      ]}
    />
  ))
}

/**
 * Full-screen annotation canvas for bug report screenshots.
 * Supports freehand drawing and blur (redaction) boxes, then flattens the
 * result into a single image via react-native-view-shot.
 */
export function ScreenshotAnnotator({
  imageUri,
  onDone,
  onCancel,
}: ScreenshotAnnotatorProps) {
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)
  const [flattening, setFlattening] = useState(false)

  const toolRef = useRef<AnnotationTool>('pen')
  const activeRef = useRef<Annotation | null>(null)
  const captureViewRef = useRef<View>(null)

  toolRef.current = tool

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        const { locationX, locationY } = event.nativeEvent
        const annotation: Annotation =
          toolRef.current === 'pen'
            ? {
                id: newId(),
                kind: 'stroke',
                points: [{ id: newId(), x: locationX, y: locationY }],
              }
            : {
                id: newId(),
                kind: 'rect',
                startX: locationX,
                startY: locationY,
                endX: locationX,
                endY: locationY,
              }
        activeRef.current = annotation
        setActiveAnnotation(annotation)
      },
      onPanResponderMove: event => {
        const current = activeRef.current
        if (!current) {
          return
        }

        const { locationX, locationY } = event.nativeEvent
        const updated: Annotation =
          current.kind === 'stroke'
            ? {
                ...current,
                points: appendInterpolated(current.points, locationX, locationY),
              }
            : { ...current, endX: locationX, endY: locationY }
        activeRef.current = updated
        setActiveAnnotation(updated)
      },
      onPanResponderRelease: () => {
        const current = activeRef.current
        activeRef.current = null
        setActiveAnnotation(null)
        if (current) {
          setAnnotations(previous => [...previous, current])
        }
      },
      onPanResponderTerminate: () => {
        activeRef.current = null
        setActiveAnnotation(null)
      },
    }),
  ).current

  const handleUndo = useCallback(() => {
    setAnnotations(previous => previous.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setAnnotations([])
  }, [])

  const handleDone = useCallback(async () => {
    if (flattening) {
      return
    }

    const viewShot = loadViewShot()
    if (!viewShot || annotations.length === 0) {
      onDone(imageUri)
      return
    }

    setFlattening(true)
    try {
      const flattenedUri = await viewShot.captureRef(captureViewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
      })
      onDone(flattenedUri)
    } catch (err) {
      console.warn(
        '[Mite] Failed to flatten annotations, using original screenshot:',
        err,
      )
      onDone(imageUri)
    } finally {
      setFlattening(false)
    }
  }, [annotations.length, flattening, imageUri, onDone])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Annotate</Text>
        <Pressable
          accessibilityRole="button"
          disabled={flattening}
          onPress={handleDone}
          style={styles.headerButton}
        >
          <Text style={[styles.headerButtonText, styles.headerDoneText]}>
            {flattening ? 'Saving…' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <View collapsable={false} ref={captureViewRef} style={styles.canvas}>
        <Image resizeMode="contain" source={{ uri: imageUri }} style={styles.image} />
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          {annotations.map(annotation => renderAnnotation(annotation))}
          {activeAnnotation ? renderAnnotation(activeAnnotation) : null}
        </View>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTool('pen')}
          style={[styles.toolButton, tool === 'pen' && styles.toolButtonActive]}
        >
          <Text style={styles.toolButtonText}>Draw</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTool('blur')}
          style={[styles.toolButton, tool === 'blur' && styles.toolButtonActive]}
        >
          <Text style={styles.toolButtonText}>Blur</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={annotations.length === 0}
          onPress={handleUndo}
          style={[styles.toolButton, annotations.length === 0 && styles.toolDisabled]}
        >
          <Text style={styles.toolButtonText}>Undo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={annotations.length === 0}
          onPress={handleClear}
          style={[styles.toolButton, annotations.length === 0 && styles.toolDisabled]}
        >
          <Text style={styles.toolButtonText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C0F',
  },
  header: {
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
  headerDoneText: {
    color: '#4FC3F7',
    fontWeight: '600',
    textAlign: 'right',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  canvas: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  penDot: {
    position: 'absolute',
    width: PEN_WIDTH,
    height: PEN_WIDTH,
    borderRadius: PEN_WIDTH / 2,
    backgroundColor: PEN_COLOR,
  },
  redactRect: {
    position: 'absolute',
    backgroundColor: BLUR_COLOR,
    borderRadius: 4,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  toolButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#1D2027',
  },
  toolButtonActive: {
    backgroundColor: '#33415C',
  },
  toolButtonText: {
    color: '#E7E9EE',
    fontSize: 14,
    fontWeight: '500',
  },
  toolDisabled: {
    opacity: 0.4,
  },
})
