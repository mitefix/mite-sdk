# MiteSDK

A React Native SDK for managing app releases and version tracking.

## Installation

```bash
npm install @mite/mite-sdk
# or
yarn add @mite/mite-sdk
# or
bun add @mite/mite-sdk
```

## Setup

### 1. Initialize Mite

Create a Mite instance and initialize it in your app's entry point:

```typescript
import { Mite, MiteProvider } from '@mite/mite-sdk'

const mite = new Mite({
  apiKey: process.env.EXPO_PUBLIC_MITE_API_KEY,
})

mite.init()

export default function RootLayout() {
  return (
    <MiteProvider miteInstance={mite}>
      {/* Your app */}
    </MiteProvider>
  )
}
```

### 2. Configuration Options

```typescript
interface MiteConfig {
  apiKey?: string    // Your API key
  endpoint?: string  // Custom backend endpoint (optional)
  timeout?: number   // Request timeout in ms (default: 5000)
  retries?: number   // Max retry attempts for failed requests
}
```

## Usage

### useReleases Hook

Fetch app releases with the `useReleases` hook:

```typescript
import { useReleases } from '@mite/mite-sdk'

export default function ReleasesScreen() {
  const { releases, loading, error, refetch } = useReleases({
    platform: 'ios',  // 'ios' | 'android' | 'all'
    limit: 10,
    enabled: true,
  })

  if (loading) return <Text>Loading...</Text>
  if (error) return <Text>Error: {error.message}</Text>

  return (
    <FlatList
      data={releases}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.version} (Build {item.versionCode})</Text>
          <Text>{item.notes}</Text>
        </View>
      )}
      onRefresh={refetch}
      refreshing={loading}
    />
  )
}
```

### Direct API Access

You can also fetch releases directly using the Mite instance:

```typescript
import { useMite } from '@mite/mite-sdk'

const mite = useMite()

const releases = await mite.getReleases({
  platform: 'android',
  limit: 5,
})
```

### Release Object

```typescript
interface Release {
  id: string
  version: string
  versionCode: number
  platform: 'ios' | 'android' | 'all'
  notes?: string
  releasedAt?: number
  createdAt: number
}
```

## License

MIT
