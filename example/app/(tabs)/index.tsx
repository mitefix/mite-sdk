import ParallaxScrollView from '@/components/ParallaxScrollView'
import { useMite } from '@usemite/mite-sdk'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  const mite = useMite()
  const router = useRouter()
  const [identifying, setIdentifying] = useState(false)

  const identifyUser = async () => {
    setIdentifying(true)
    try {
      const result = await mite.identify({
        userIdentifier: 'example-user-1',
        email: 'user@example.com',
        name: 'Example User',
      })
      Alert.alert(
        'Identified',
        result.created ? 'New profile created' : 'Existing profile updated',
      )
    } catch (error) {
      Alert.alert(
        'Identify failed',
        error instanceof Error ? error.message : 'Unknown error',
      )
    } finally {
      setIdentifying(false)
    }
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      <View style={styles.container}>
        <Text style={styles.title}>Mite SDK Demo</Text>

        <Pressable style={styles.button} onPress={() => router.navigate('/bug-report')}>
          <Text style={styles.buttonText}>Report a Bug</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={identifyUser} disabled={identifying}>
          <Text style={styles.buttonText}>
            {identifying ? 'Identifying…' : 'Identify User'}
          </Text>
        </Pressable>
      </View>
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
})
