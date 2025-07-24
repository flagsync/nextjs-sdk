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
 * Creates a FlagSync client instance that can be used across multiple feature flags.
 * This function should be called once to create a singleton client for your application.
 */
export function createClient(config: FsConfig): FsClient {
  const instance = FlagSyncFactory({
    ...config,
    metadata: {
      sdkName: '__SDK_NAME__',
      sdkVersion: '__SDK_VERSION__',
    },
  });
  return instance.client();
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
