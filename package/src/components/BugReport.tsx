import { type PropsWithChildren, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

export function BugReport({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <Pressable onPress={() => setVisible(true)}>{children}</Pressable>
      <Modal
        presentationStyle="pageSheet"
        visible={visible}
        onDismiss={() => setVisible(false)}
        animationType="slide"
      >
        <View style={styles.container}>
          <Text>Report Bug</Text>
          <Pressable onPress={() => setVisible(false)}>
            <Text>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 12,
  },
  submit: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  submitText: {
    fontWeight: '600',
    fontSize: 16,
  },
})
