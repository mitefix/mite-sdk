# Mite SDK

React Native SDK for [Mite](https://github.com/usemite/mite-sdk) — in-app bug reporting, user feedback, feature requests, and release notes.

## Installation

```bash
bun add @usemite/mite-sdk
# or
npm install @usemite/mite-sdk
```

The SDK has no runtime dependencies. It requires `expo-device`, `react`, and `react-native` as peers:

```bash
bun add expo-device
```

## Quick Start

Create a `Mite` instance at your app's entry point and wrap your app in `MiteProvider`:

```tsx
import { Mite, MiteProvider } from '@usemite/mite-sdk'

const mite = new Mite({
  apiKey: process.env.EXPO_PUBLIC_MITE_API_KEY as string,
})

export default function RootLayout() {
  return (
    <MiteProvider instance={mite}>
      {/* Your app */}
    </MiteProvider>
  )
}
```

### Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | required | API key from the Mite dashboard |
| `endpoint` | `string` | Mite API | Override the API base URL |
| `timeout` | `number` | `10000` | Request timeout in milliseconds |
| `maxRetries` | `number` | `2` | Retry attempts for failed reads (writes are never retried) |

## Bug Reports

```tsx
import { useMite } from '@usemite/mite-sdk'

function ReportScreen() {
  const mite = useMite()

  const submit = async () => {
    const { id } = await mite.submitBug({
      title: 'Crash when opening settings',
      description: 'The app crashes every time I tap Settings.',
      stepsToReproduce: '1. Open app\n2. Tap Settings',
      priority: 'HIGH',
      reporterEmail: 'user@example.com',
      attachments: [{ uri: image.uri, fileName: image.fileName, mimeType: image.mimeType }],
    })
  }
}
```

Device information (OS, model, screen size, emulator status) is collected automatically and sent with every report. Extend or override it with `deviceInfo: { locale: 'en-US' }`.

Attachments are local file URIs (for example from `expo-image-picker`); the SDK uploads them before creating the report.

## Identify Users

Tie reports and feedback to your users:

```ts
await mite.identify({
  userIdentifier: user.id,
  email: user.email,
  name: user.name,
})
```

At least one of `userIdentifier` or `anonymousId` is required.

## Releases

```tsx
import { useReleases } from '@usemite/mite-sdk'

function ReleasesScreen() {
  const { releases, loading, error, refetch } = useReleases({ platform: 'ios', limit: 10 })
}
```

The hook fetches on mount by default; pass `enabled: false` to defer until `refetch()` is called. Outside React, use `mite.getReleases(options)`.

## Feature Requests

```ts
const requests = await mite.getFeatureRequests()

await mite.createFeatureRequest({
  title: 'Dark mode',
  description: 'Please add a dark theme.',
  authorName: 'Jane',
  authorEmail: 'jane@example.com',
})

const { voted, voteCount } = await mite.voteFeatureRequest({
  featureRequestId: requests[0].id,
  voterEmail: 'jane@example.com',
})

const votedIds = await mite.getVotedFeatureRequestIds('jane@example.com')
```

Votes are a toggle: voting twice with the same email removes the vote.

## Error Handling

Every method throws a `MiteError` on failure:

```ts
import { MiteError } from '@usemite/mite-sdk'

try {
  await mite.submitBug({ title, description })
} catch (error) {
  if (error instanceof MiteError) {
    if (error.isRateLimited) {
      // error.retryAfter — seconds to wait
    }
    if (error.isAuthError) {
      // invalid API key or missing scope
    }
    console.log(error.status, error.message)
  }
}
```

Failed reads (GET requests) are retried automatically with exponential backoff. Writes such as `submitBug` are never retried, so a report is never submitted twice.

## Development

```bash
cd package
bun typecheck   # typecheck library and tests
bun test        # run tests
bun run build   # build with react-native-builder-bob

cd ../example
bun start       # run the example app
```

## License

MIT
