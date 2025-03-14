# FlagSync Adapter for Vercel Flags

[FlagSync](https://www.flagsync.com) brings affordable, user-friendly feature flags and A/B testing to indie hackers and growing businesses. This adapter integrates FlagSync with [Vercel Flags](https://vercel.com/docs/flags) in Next.js apps. [Get started](https://docs.flagsync.com/getting-started/set-up-flagsync) today!

[![npm version](https://badge.fury.io/js/%40flagsync%2Fvercel-flags-sdk.svg)](https://badge.fury.io/js/%40flagsync%2Fvercel-flags-sdk)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/flagsync.svg?style=social&label=Follow%20%40flagsync)](https://twitter.com/flagsync)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

---

## Getting Started

Refer to the [SDK documentation](https://docs.flagsync.com/sdks/next.js) for more information on how to use this library.

### Compatibility

- Requires [Next.js](https://nextjs.org/) 14+
- Compatible with Node.js 16+ and ES5.
- TypeScript is fully supported.
- **Note:** This SDK is optimized for Next.js App Router. For non-Next.js Node.js apps, use the [FlagSync Node SDK](https://github.com/flagsync/node-client) instead.

### Prerequisites
- Install the SDK: `npm install @flagsync/vercel-flags-sdk flags/next`
- Set the `FLAGSYNC_SDK_KEY` environment variable in your `.env` file.

## Basic Setup

FlagSync lets you toggle features and personalize experiences in your Next.js App Router application. Follow these steps to set it up.

### Step 1: Create the FlagSync client singleton

Initialize the client with your server-side SDK key:

```typescript
// lib/flagsync.ts
import { createFlagSyncClient } from '@flagsync/vercel-flags-sdk';

export const client = createFlagSyncClient({
  sdkKey: process.env.FLAGSYNC_SDK_KEY!,
});
```

### Step 2: Set up user identification

> [!NOTE]
> Feature flags in FlagSync use user context (e.g. via `identify`) to enable personalized experiences.

The `identify` function defines how users are identified (e.g., via cookies, headers, or session data). See [Identify](#identify) for more details.

```typescript
// lib/flagsync.ts
import {
  createIdentify,
  createFlagSyncClient,
} from '@flagsync/vercel-flags-sdk';

export const identify = createIdentify(({ cookies }) => {
  const userId = cookies.get('user-id')?.value;       // Authenticated user ID
  const visitorId = cookies.get('visitor-id')?.value; // Unauthenticated visitor ID
  return {
    key: userId ?? visitorId ?? 'anonymous'           // Fallback to 'anonymous'
  };
});
```
> [!CAUTION]
> While `anonymous` user contexts are supported, always provide a unique identifier (even for unauthenticated users) to ensure consistent flag evaluation.
> 
> See [Identify](#identify) for more details.

### Step 3: Define a feature flag

Create a flag definition using the shared `client` and `identify` function:

```typescript
// app/dashboard/flags.ts
import { flag } from 'flags/next';
import { client, identify } from '@/lib/flagsync';
import { createStringFlagAdaptor } from '@flagsync/vercel-flags-sdk';

export const dashboardFlag = flag<string>({
  identify,                                 // Links flag to user context
  key: 'dashboardFlag',                     // Unique flag key
  adapter: createStringFlagAdaptor(client), // Retrieves the flag with type safety
});
```

### Step 4: Use the flag in your app

Now you can use `dashboardFlag` in your Server Components:

```typescript jsx
// app/dashboard/page.tsx

import { dashboardFlag } from '@/app/dashboard/flags';

export default async function DashboardPage() {
  const dashboard = await dashboardFlag();

  return (
    <div>The value of {dashboardFlag.key} is {dashboard}</div>
  );
}
```

## Type-Safe Feature Flags

FlagSync supports multiple flag types for different use cases. Use the type-specific adapter depending on your flag type: 

- `createBoolFlagAdaptor`: For boolean flags
- `createStringFlagAdaptor`: For string flags
- `createNumberFlagAdaptor`: For numeric flags
- `createJsonFlagAdaptor`: For JSON object flags

```typescript
// app/<route>/flags.ts
import { client, identify } from '@/lib/flagsync';
import {
  createBoolFlagAdaptor,
  createJsonFlagAdaptor,
  createNumberFlagAdaptor,
  createStringFlagAdaptor,
} from '@flagsync/vercel-flags-sdk';
import { flag } from '@vercel/flags';

// Boolean flag for feature toggles
export const betaFeatureFlag = flag<boolean>({
  identify,
  key: 'beta-feature-enabled',
  adapter: createBoolFlagAdaptor(client),
});

// String flag for UI variants
export const heroCtaFlag = flag<string>({
  identify,
  key: 'hero-cta',
  adapter: createStringFlagAdaptor(client),
});

// Number flag for pricing tiers
export const discountFlag = flag<number>({
  identify,
  key: 'price-discount',
  adapter: createNumberFlagAdaptor(client),
});

// JSON flag for complex configurations
export const featureConfigFlag = flag<{
  enabled: boolean;
  limits: { requests: number; storage: number };
}>({
  identify,
  key: 'feature-config',
  adapter: createJsonFlagAdaptor(client),
});
```

## Identify

The `identify` function links feature flags to user contexts in FlagSync by returning an `FsUserContext` object.

```typescript
type FsUserContext = {
  key: string;  // Unique identifier for the user
  attributes?: Record<string, string | number | boolean>; // Optional custom data (used in individual targeting)
};
```
* `key`: A unique ID for the user (required)
* `attributes`: Optional metadata (e.g., user agent, region, role, department) to personalize flag evaluations.

> [!IMPORTANT]
> User contexts enable personalized flag evaluations via [Individual Targeting](https://docs.flagsync.com/sdks/sdk-concepts/flag-evaluation#does-the-flag-have-any-individual-targeting-rules), and consistent experiences during [Percentage Rollouts](https://docs.flagsync.com/sdks/sdk-concepts/flag-evaluation#does-the-flag-have-a-percentage-rollout).

We recommend:
1. Using a helper function (getFlagSyncUserContext) to build the full context.
2. Setting cookies in middleware for the key.

Here's how:

### Step 1: Define a helper function

Create a utility to build the user context:

```typescript
// lib/flagsync.user-context.ts
import type { ReadonlyRequestCookies, ReadonlyHeaders } from 'flags';
import { dedupe } from 'flags/next';
import { nanoid } from 'nanoid';
import type { NextRequest } from 'next/server';

const generateId = dedupe(async () => nanoid());

export const getFlagSyncUserContext = async (
  cookies: ReadonlyRequestCookies | NextRequest['cookies'],
  headers: ReadonlyHeaders | NextRequest['headers'],
) => {
  const userId = cookies.get('user-id')?.value; // Authenticated user
  const visitorId = cookies.get('visitor-id')?.value; // Anonymous visitor

  return {
    key: userId ?? visitorId ?? (await generateId()), // Fallback to new ID
    attributes: {
      userAgent: headers.get('user-agent') || 'unknown', // Browser info
      region: headers.get('x-region-code') || 'default', // Custom header
    },
  };
};

```
### Step 2: Set up identification

Use the helper in `identify`:

```typescript
// lib/flagsync.ts
import { createIdentify, createFlagSyncClient } from '@flagsync/vercel-flags-sdk';
import { getFlagSyncUserContext } from '@lib/flagsync.user-context';

export const identify = createIdentify(({ cookies, headers }) => {
  return getFlagSyncUserContext(cookies, headers);
});

export const client = createFlagSyncClient({
  sdkKey: process.env.FLAGSYNC_SDK_KEY!,
});
```

### Step 3: Handle cookies in middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Example: Get userId from a JWT or API call (replace with your logic)
  const jwt = request.cookies.get('jwt')?.value;
  let userId: string | undefined;
  if (jwt) {
    userId = 'user@example.com'; // Stub: e.g., await decodeJwt(jwt).email
  }

  if (userId) {
    response.cookies.set('user-id', userId, { maxAge: 60 * 60 * 24 * 7 });
  } else {
    const visitorId = request.cookies.get('visitor-id')?.value ?? nanoid();
    response.cookies.set('visitor-id', visitorId, { maxAge: 60 * 60 * 24 * 365 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

```

## Next Steps

- Configure flags in the [FlagSync dashboard](https://www.flagsync.com/dashboard).
- Explore the [Docs](https://docs.flagsync.com/) for information on how to use FlagSync.

## Environment Variables

Required environment variables:

- `FLAGSYNC_SDK_KEY`: Your server-side FlagSync SDK key (required)

### License

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
