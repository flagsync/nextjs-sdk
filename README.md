# FlagSync adapter for Vercel Flags

At [FlagSync](https://www.flagsync.com), we believe the power of feature flags and A/B testing should be accessible to everyone, regardless of business size or budget.

That's why we developed an affordable, user-friendly platform that delivers the core functionality needed by indie hackers and growing businesses, without unnecessary complexity. [Get started](https://docs.flagsync.com/getting-started/set-up-flagsync) using FlagSync today!

[![npm version](https://badge.fury.io/js/%40flagsync%2Fvercel-flags-sdk.svg)](https://badge.fury.io/js/%40flagsync%2Fvercel-flags-sdk)
[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/flagsync.svg?style=social&label=Follow%20%40flagsync)](https://twitter.com/flagsync)

---

## Compatibility
* Requires [Next.js](https://nextjs.org/) 14+
* Compatible with Node.js 16+ and ES5.
* TypeScript is fully supported.

## Getting Started

Refer to the [SDK documentation](https://docs.flagsync.com/sdks/next.js) for more information on how to use this library.

## Node

This SDK wraps the [Node SDK](https://github.com/flagsync/node-client) for smoother integration with [Next.js](https://nextjs.org/) App router. However, if you're building a non-Next.js application for Node.js, you should use our [Node SDK](https://github.com/flagsync/node-client) instead.

# FlagSync Adapter for Vercel Flags

This package provides a FlagSync adapter for Vercel Flags, allowing you to use FlagSync as your feature flag provider with Vercel's feature flag system.

## Installation

```bash
npm install @flagsync/vercel-flags-sdk @vercel/flags
# or
yarn add @flagsync/vercel-flags-sdk @vercel/flags
# or
pnpm add @flagsync/vercel-flags-sdk @vercel/flags
```

## Usage

### Basic Setup

```typescript
import { flags } from '@vercel/flags';
import { FlagSyncAdapter } from '@flagsync/vercel-flags-sdk';

const adapter = new FlagSyncAdapter({
  sdkKey: process.env.FLAGSYNC_SDK_KEY
});

const client = flags({ adapter });
```

### With Type Safety

```typescript
// config.ts
import { flags } from '@vercel/flags';
import { FlagSyncAdapter } from '@flagsync/vercel-flags-sdk';

// Define your feature flag types
type FeatureFlags = {
  'new-feature': boolean;
  'beta-feature': {
    enabled: boolean;
    config: {
      maxUsers: number;
      allowedRoles: string[];
    };
  };
};

// Create a typed client
const adapter = new FlagSyncAdapter({
  sdkKey: process.env.FLAGSYNC_SDK_KEY,
});

export const client = flags<FeatureFlags>({ adapter });
```

### In React Components

```typescript
import { useFlags } from '@vercel/flags';
import type { FeatureFlags } from './config';

function MyComponent() {
  const flags = useFlags<FeatureFlags>();

  if (flags['new-feature']) {
    return <div>New Feature Enabled!</div>;
  }

  return <div>Default View</div>;
}
```

### In Next.js Middleware

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { client } from './config';

export async function middleware(request: NextRequest) {
  const isEnabled = await client.get('new-feature', {
    entities: {
      key: request.headers.get('x-user-id'),
      attributes: {
        role: request.headers.get('x-user-role'),
        department: request.headers.get('x-user-dept')
      }
    },
  });

  if (!isEnabled) {
    return NextResponse.redirect(new URL('/not-available', request.url));
  }

  return NextResponse.next();
}
```

## Environment Variables

Make sure to set the following environment variables:

- `FLAGSYNC_SDK_KEY`: Your FlagSync SDK key

## License

Apache-2.0
