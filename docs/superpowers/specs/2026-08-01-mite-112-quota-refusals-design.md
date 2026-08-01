# MITE-112 — Handle plan quota refusals (402) in the SDK

Date: 2026-08-01
Ticket: https://linear.app/henry-pl-llc/issue/MITE-112
Related: MITE-109 (server caps), MITE-113 (Clerk plan features)

## Problem

MITE-109 adds two quota refusals at the ingest boundary. Both use HTTP 402. The
SDK does not know about them. Until it does, the caps cannot go live, because an
over-quota app would get a response the SDK does not handle.

Three parts of the SDK behave incorrectly today:

- `ApiClient.setupRetry()` retries every rejected response. It does not look at
  the status. A 402 is retried when `MiteConfig.retries` is more than 0.
- `BugReporter.getUploadUrl()` throws inside the attachment loop. A storage
  refusal destroys the whole report. The required behaviour is the opposite.
- `useBugReport()` throws the error to the caller.

One part is already correct: `Mite.submitBug()` puts a failed request in the
offline queue only when `isNetworkError(err)` is true. A 402 is an HTTP
response, so it does not go in the queue. A test must keep this true.

## Server contract

Both refusals use 402, never 429. A 429 tells a client to try again. A retry
against a quota that resets each month repeats until the calendar changes.

`POST /api/v1/bug-reports` can refuse with `REPORT_QUOTA_EXCEEDED`.
`POST /api/v1/upload-url` can refuse with either code.

```json
{
  "error": "This account has used all 50 reports in its current billing period.",
  "code": "REPORT_QUOTA_EXCEEDED",
  "quota": { "limit": 50, "used": 50, "resets_at": 1785000000000 }
}
```

`resets_at` is in milliseconds. It is on the report code only. Attachment
storage is a standing total and does not reset.

Branch on `code`, not on the endpoint.

## Public contract

### New types (`package/src/types.ts`)

```ts
export type MiteQuotaCode = 'REPORT_QUOTA_EXCEEDED' | 'STORAGE_QUOTA_EXCEEDED'

export interface MiteQuota {
  limit: number
  used: number
  /** Milliseconds since the epoch. Sent for the report code only. */
  resetsAt?: number
}

export interface MiteQuotaRefusal {
  code: MiteQuotaCode
  message: string
  quota: MiteQuota
}

export type SubmitBugResult =
  | {
      ok: true
      report: SubmitBugReportResponse
      droppedAttachments?: { count: number; refusal: MiteQuotaRefusal }
    }
  | { ok: false; refusal: MiteQuotaRefusal }
```

`ok: false` means the server made no report. Read `refusal.code` to know why.
`ok: true` with `droppedAttachments` means the report exists but the files did
not upload.

The SDK reads the server field `resets_at` and gives the developer `resetsAt`.
This follows the pattern already in the SDK: request payloads are snake_case,
response types are camelCase (see `Release.releasedAt`).

### New config option

```ts
// MiteConfig
onQuotaExceeded?: (refusal: MiteQuotaRefusal) => void
```

The SDK calls it one time for each refusal, including a refusal that the local
gate serves without a request. The SDK never throws for a 402.

### Changed signatures

- `Mite.submitBug()` returns `Promise<SubmitBugResult>`. This is a break, so the
  package goes to 0.3.0.
- `useBugReport()` gets `refusal: MiteQuotaRefusal | null`. `lastResponse` is set
  only when `ok` is true. `reset()` clears both.
- `ShakeToReport` and `StoreReviewPrompt` keep their `onSubmitted` and
  `onFeedbackSubmitted` prop types, because those callbacks fire only on the
  `ok: true` branch. Both get a new optional `onQuotaExceeded` prop.

## Mechanics

### New unit: `package/src/utils/quota.ts`

```ts
export function parseQuotaRefusal(err: unknown): MiteQuotaRefusal | null
```

It returns a refusal only when the response status is 402 and `data.code` is one
of the two known codes. Anything else returns `null` and stays an ordinary
error. It maps `quota.resets_at` to `resetsAt`. This is the only place that
knows the wire format, so the request path does not touch axios internals, and
the queue can recognise a refusal without knowing what to do about it.

### Request path (`BugReporter.sendBugReportToServer`)

The method returns `SubmitBugResult`. The attachment loop changes:

| Event | Action |
|---|---|
| `/upload-url` refuses with `STORAGE_QUOTA_EXCEEDED` | Stop the loop. Keep no attachments. Post the report. Return `ok: true` with `droppedAttachments`. |
| `/upload-url` refuses with `REPORT_QUOTA_EXCEEDED` | Stop. Send no second request. Return `ok: false`. |
| `/bug-reports` refuses with either code | Return `ok: false` with that refusal. |
| Any other error | Throw, as it does today. |

The dropped count is the number of attachments that did not upload, which is
the number supplied less the number already uploaded. The loop stops at the
first refusal, and storage is a standing total, so the files that are left
cannot fit either. Files that uploaded before the refusal stay on the report.

A `STORAGE_QUOTA_EXCEEDED` from `/bug-reports` is almost impossible, because
storage is consumed at upload time. The SDK does not post a second time without
the attachments. It returns `ok: false` with that refusal.

### Guard 1 — the retry interceptor (`utils/client.ts`)

Do not retry a response with a status from 400 to 499. A client error is not
transient. This fixes the ticket and a latent bug at the same time.

### Guard 2 — the offline queue (`OfflineQueue.ts`)

In the `catch` block of `processQueue()`, test `parseQuotaRefusal(err)` first. On
a refusal, drop the entry immediately instead of counting retries.

### Guard 3 — the in-memory gate (`Mite.ts`)

One private field, `reportQuotaRefusal: MiteQuotaRefusal | null`. `submitBug()`
checks it first and returns `ok: false` without a request. The gate opens again
when `Date.now()` is at or after `resetsAt`. `destroy()` clears it. Only
`REPORT_QUOTA_EXCEEDED` sets it. A storage refusal never blocks a report.

The gate is not persisted. An app restart or a plan upgrade in the same period
costs at most one wasted request.

## Tests

New file `package/src/__tests__/quota.test.ts` for the parser. Additions to
`Mite.test.ts`, `client.test.ts`, and `OfflineQueue.test.ts`. One test for each
acceptance criterion:

1. `REPORT_QUOTA_EXCEEDED` from `/bug-reports` resolves `ok: false`, does not
   throw, and sends one request.
2. `STORAGE_QUOTA_EXCEEDED` from `/upload-url` posts the report with no
   attachments and resolves `ok: true` with `droppedAttachments.count`.
3. `REPORT_QUOTA_EXCEEDED` from `/upload-url` sends one request only and does
   not post to `/bug-reports`.
4. A 402 with `retries: 3` sends one request.
5. A 402 does not go in `OfflineQueue`, and a queued entry that meets a 402 is
   dropped immediately.
6. The second `submitBug()` after a report refusal sends no request.
7. `onQuotaExceeded` fires one time for each refusal.

## Documentation

- New page `docs/content/docs/quotas.mdx`: the two codes, the behaviour of each,
  and a `useBugReport` example that shows the refusal to the user.
- Updates: `bug-reports.mdx` and `mite-instance.mdx` for the new return type,
  `hooks.mdx` for `refusal`, `types.mdx` for the new types, `offline-queue.mdx`
  to state that a 402 never goes in the queue, `components.mdx` for the new
  prop.
- A migration note for 0.3.0.

## Out of scope

- Persisting the gate across app restarts.
- A general `onError` channel for faults that are not quota refusals.
- Server-side work. MITE-109 and MITE-113 cover that.
