# MiteSDK

A React Native SDK for managing releases, bug reports, and feature requests.

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
import AsyncStorage from '@react-native-async-storage/async-storage'
// or: import { MMKV } from 'react-native-mmkv'
import { Mite, MiteProvider } from '@mite/mite-sdk'

const mite = new Mite({
  apiKey: process.env.EXPO_PUBLIC_MITE_API_KEY,
  identityStorage: AsyncStorage, // or: new MMKV()
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
  anonymousId?: string // Optional override for the generated anonymous user id
  identityStorage?: MiteIdentityStorage | MiteMMKVLikeStorage // AsyncStorage or MMKV instance
  identificationOptOut?: boolean // Start in anonymous-only mode
  enableNavigationBreadcrumbs?: boolean // Attach the navigation trail to bug reports (default: true)
  maxNavigationBreadcrumbs?: number // Screens kept in the navigation trail (default: 20)
}
```

When `mite.init()` runs, the SDK generates an anonymous user ID automatically and syncs it to the identify endpoint in the background. If you provide `identityStorage`, that anonymous ID survives app restarts so the same installed app instance keeps the same anonymous identity. Later, you can call `identify` with a real `user_identifier`, and the SDK will include the same anonymous ID so the backend can link the anonymous user to the known user.

```typescript
await mite.identify({
  user_identifier: 'user_123',
  email: 'user@example.com',
})
```

When the user logs out, clear the identified user but keep the anonymous ID:

```typescript
await mite.logout()
```

If the user opts out of being identified, switch the SDK into anonymous-only mode. In this mode Mite still sends `anonymous_id`, but it stops sending `user_identifier`, email/name fields, metadata, and default `device_info`.

```typescript
await mite.setIdentificationOptOut(true)
```

### 3. Navigation Breadcrumbs (optional)

Mite can capture a trail of the screens visited before a bug report is submitted (a ring buffer of the last 20 by default) and attach it to the report under `environment.navigation_trail`. Both Expo Router and React Navigation are supported through one hook — neither library is required to use the SDK.

**Expo Router** — add one line to your root layout:

```tsx
import { useNavigationContainerRef } from 'expo-router'
import { useMiteNavigationTracking } from '@mite/mite-sdk'

export default function RootLayout() {
  useMiteNavigationTracking(useNavigationContainerRef())
  // ...
}
```

**React Navigation** — pass the container ref you already use:

```tsx
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { useMiteNavigationTracking } from '@mite/mite-sdk'

function App() {
  const navigationRef = useNavigationContainerRef()
  useMiteNavigationTracking(navigationRef)

  return <NavigationContainer ref={navigationRef}>{/* ... */}</NavigationContainer>
}
```

If you use a custom navigation solution, record screens manually:

```typescript
import { recordNavigationBreadcrumb, clearNavigationTrail } from '@mite/mite-sdk'

recordNavigationBreadcrumb('Settings')
clearNavigationTrail() // e.g. on logout
```

Disable the feature or change the buffer size with `enableNavigationBreadcrumbs` and `maxNavigationBreadcrumbs` in `MiteConfig`.

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

### What's New Widget

Show published release notes in-app after an update. The widget tracks the last seen version locally and shows once per new app version. Release notes support a simple markdown subset (headings, bullet lists, bold, italic, inline code).

```tsx
import { WhatsNew, showWhatsNew } from '@mite/mite-sdk'

export default function RootLayout() {
  return (
    <>
      {/* your app */}
      <WhatsNew />
    </>
  )
}

// Open it on demand (e.g. from a settings screen)
showWhatsNew()
```

The current app version is detected via `expo-application` (falling back to `expo-constants`) when installed — both are optional peer dependencies — or can be passed explicitly with `currentVersion`. By default nothing is shown on a fresh install; opt in with `showOnFirstLaunch`.

For a custom UI, use the `useWhatsNew` hook directly:

```tsx
import { useWhatsNew } from '@mite/mite-sdk'

const { visible, releases, show, dismiss } = useWhatsNew({ platform: 'ios' })
```

### Feature Requests

Fetch the feature request board for your app:

```typescript
const requests = await mite.getFeatureRequests()
```

Create a new feature request:

```typescript
await mite.createFeatureRequest({
  title: 'Offline mode',
  description: 'Let users browse cached content without a connection',
  author_name: 'Taylor',
  author_email: 'taylor@example.com',
})
```

Toggle a vote and fetch a voter’s existing votes:

```typescript
await mite.voteFeatureRequest({
  feature_request_id: 'fr_123',
  voter_email: 'taylor@example.com',
})

const votedIds = await mite.getFeatureRequestVotes('taylor@example.com')
```

Or use the `useFeatureRequests` hook to fetch the board and vote state together:

```typescript
import { useFeatureRequests } from '@mite/mite-sdk'

const { featureRequests, votedFeatureRequestIds, loading, refetch } =
  useFeatureRequests({
    enabled: true,
    voterEmail: 'taylor@example.com',
  })
```

### Store Review Prompt

Ask users if they are enjoying the app. Happy users are routed to the native
store review dialog, unhappy users are routed into a Mite feedback form
instead of the store.

This feature uses the optional [`expo-store-review`](https://docs.expo.dev/versions/latest/sdk/storereview/)
peer dependency:

```sh
npx expo install expo-store-review
```

If `expo-store-review` is not installed, the SDK logs a `[Mite]` warning and
skips the store review request instead of crashing.

```typescript
import { StoreReviewPrompt } from '@mite/mite-sdk'

export default function App() {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <Button title="Rate us" onPress={() => setVisible(true)} />
      <StoreReviewPrompt
        visible={visible}
        onClose={() => setVisible(false)}
        onPositive={(reviewRequested) => console.log({ reviewRequested })}
        onFeedbackSubmitted={(response) => console.log(response.id)}
      />
    </>
  )
}
```

By default, a negative answer opens a built-in feedback form that submits a
bug report through `mite.submitBug`. Pass `onNegative` to route users into
your own bug/feedback flow instead:

```tsx
<StoreReviewPrompt
  visible={visible}
  onClose={() => setVisible(false)}
  onNegative={() => router.push('/report-bug')}
/>
```

You can also trigger the store review dialog imperatively:

```typescript
const available = await mite.isStoreReviewAvailable()
const reviewRequested = await mite.requestStoreReview()
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
