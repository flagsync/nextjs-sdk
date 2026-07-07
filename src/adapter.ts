import {
  FeatureFlags,
  FlagReturnType,
  FlagSyncFactory,
  FsClient,
  type FsConfig,
  type FsUserContext,
  NoExplicitReturnType,
} from '@flagsync/node-sdk';
import { Adapter, FlagDeclaration } from 'flags';
import { flag } from 'flags/next';

/**
 * Clients are cached on globalThis, keyed by SDK key, so they survive module
 * re-evaluation — Next.js dev HMR and multiple server bundles importing this
 * module would otherwise each construct a fresh client, leaking sync
 * connections (each with default settings if their call site differs).
 * Symbol.for() resolves to the same symbol across bundles in one process.
 */
const CLIENT_CACHE_KEY = Symbol.for('@flagsync/nextjs-sdk:clients');

interface CachedClient {
  client: FsClient;
  configFingerprint: string;
}

function getClientCache(): Map<string, CachedClient> {
  const store = globalThis as {
    [CLIENT_CACHE_KEY]?: Map<string, CachedClient>;
  };
  store[CLIENT_CACHE_KEY] ??= new Map();
  return store[CLIENT_CACHE_KEY];
}

/**
 * Serializable view of the config, used only to detect (and warn about)
 * config changes that cannot apply to an already-cached client. Functions
 * (loggers, etc.) are omitted by JSON.stringify; key order follows the
 * caller's object literal, which is stable for a given call site.
 */
function fingerprintConfig(config: FsConfig): string {
  try {
    return JSON.stringify(config);
  } catch {
    return '';
  }
}

/**
 * Creates a FlagSync client instance that can be used across multiple feature flags.
 * Returns the same instance for repeated calls with the same SDK key, even
 * across HMR reloads — note this means config changes for an existing SDK key
 * only take effect after a server restart.
 */
export function createClient(config: FsConfig): FsClient {
  const cache = getClientCache();

  const existing = cache.get(config.sdkKey);
  if (existing) {
    if (
      process.env.NODE_ENV !== 'production' &&
      existing.configFingerprint !== fingerprintConfig(config)
    ) {
      console.warn(
        '***************************************************************',
      );
      console.warn(
        '[flagsync] createClient was called with a changed config, but a ' +
          'client for this SDK key already exists and will be reused. ' +
          'Restart the dev server to apply the new config.',
      );
      console.warn(
        '***************************************************************',
      );
    }
    return existing.client;
  }

  const instance = FlagSyncFactory({
    ...config,
    metadata: {
      sdkName: '__SDK_NAME__',
      sdkVersion: '__SDK_VERSION__',
    },
  });

  const client = instance.client();
  cache.set(config.sdkKey, {
    client,
    configFingerprint: fingerprintConfig(config),
  });
  return client;
}

/**
 * Creates an adapter factory that integrates FlagSync with Vercel's feature flag system.
 * This adapter handles the communication between your application and the FlagSync service.
 */
export function createAdapter(client: FsClient) {
  let isReady = false;

  /**
   * Ensures the FlagSync client is ready before making any flag decisions.
   * This is called internally before each flag evaluation.
   */
  const ensureReady = async () => {
    if (!isReady) {
      await client.waitForReady();
      isReady = true;
    }
  };

  function adapter<T = any>(): Adapter<
    FlagReturnType<T, string, FeatureFlags>,
    FsUserContext
  > {
    return {
      async decide({
        key,
        entities,
        defaultValue,
      }: {
        key: string;
        entities?: FsUserContext;
        defaultValue?: FlagReturnType<T, string, FeatureFlags>;
      }): Promise<FlagReturnType<T, string, FeatureFlags>> {
        await ensureReady();

        const userContext: FsUserContext = {
          key: 'anonymous',
          ...(entities ?? {}),
        };

        return client.flag(userContext, key, defaultValue);
      },
    };
  }

  return adapter;
}

/**
 * Creates an adapter factory that integrates FlagSync with Vercel's feature flag system.
 * This adapter handles the communication between your application and the FlagSync service.
 */
function createTypedAdapter(client: FsClient) {
  let isReady = false;

  /**
   * Ensures the FlagSync client is ready before making any flag decisions.
   * This is called internally before each flag evaluation.
   */
  const ensureReady = async () => {
    if (!isReady) {
      await client.waitForReady();
      isReady = true;
    }
  };

  /**
   * Creates a generic adapter instance that works with any flag.
   * This function is generic over the expected return type (R) and the key type (K)
   * to correctly type the Adapter's `decide` method.
   *
   * @template R The explicit return type for the flag (e.g., `boolean`, `string`).
   * Defaults to `NoExplicitReturnType` if not provided.
   * @template K The literal string type of the flag key. Defaults to `string`.
   * @returns An `Adapter` instance with its generic `T` correctly set to `FlagReturnType<R, K, FeatureFlags>`.
   */
  function flagSyncAdapter<
    R = NoExplicitReturnType, // The explicit return type generic
    K extends string = string, // The key type generic
  >(): Adapter<FlagReturnType<R, K, FeatureFlags>, FsUserContext> {
    return {
      async decide({
        key,
        entities,
        defaultValue,
      }: {
        key: string; // The Adapter interface mandates 'string' here.
        entities?: FsUserContext;
        defaultValue?: FlagReturnType<R, K, FeatureFlags>;
      }): Promise<FlagReturnType<R, K, FeatureFlags>> {
        await ensureReady();

        const userContext: FsUserContext = {
          key: 'anonymous',
          ...(entities ?? {}),
        };

        // Call client.flag with the generics R and K.
        // We must cast 'key as K' because the Adapter's 'key' is 'string',
        // but client.flag's 'flagKey' parameter can be more restrictive (e.g., 'keyof FeatureFlags').
        // This means strict key validation for the 'key' parameter is bypassed at this point,
        // but the return type will still be correct.
        return client.flag<R, K>(userContext, key as K, defaultValue);
      },
    };
  }

  return flagSyncAdapter;
}

/**
 * Initializes the FlagSync typed helpers.
 * @param client An FsClient instance from createFlagSyncClient.
 * @returns An object containing the typed `flag` function.
 */
export function createTypedFlag(client: FsClient) {
  const adapter = createTypedAdapter(client);
  /**
   * A type-safe wrapper around Vercel's `flag` function that is
   * aware of your FeatureFlags interface.
   */
  function typedFlag<TKey extends keyof FeatureFlags>(
    options: Omit<
      FlagDeclaration<FeatureFlags[TKey], FsUserContext>,
      'key' | 'adapter' | 'decide'
    > & {
      key: TKey;
    },
  ) {
    const specificAdapter = adapter<FeatureFlags[TKey], TKey>();

    const fullFlagDeclaration: FlagDeclaration<
      FeatureFlags[TKey],
      FsUserContext
    > = {
      ...options,
      key: options.key,
      adapter: specificAdapter as unknown as Adapter<
        FeatureFlags[TKey],
        FsUserContext
      >,
    };

    return flag(fullFlagDeclaration);
  }

  return {
    flag: typedFlag,
  };
}
