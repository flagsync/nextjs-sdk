import {
  FlagSyncFactory,
  FsClient,
  type FsConfig,
  type FsUserContext,
} from '@flagsync/node-sdk';
import { Adapter } from 'flags';

/**
 * Creates a FlagSync client instance that can be used across multiple feature flags.
 * This function should be called once to create a singleton client for your application.
 */
export function createFlagSyncClient(config: FsConfig): FsClient {
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
export function createFlagSyncAdapter(client: FsClient) {
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
   * This adapter will handle type inference based on usage context.
   */
  function flagSyncAdapter<T = any>(): Adapter<T, FsUserContext> {
    return {
      async decide({
        key,
        entities,
        defaultValue,
      }: {
        key: string;
        entities?: FsUserContext;
        defaultValue?: T;
      }): Promise<T> {
        await ensureReady();

        const userContext: FsUserContext = {
          key: 'anonymous',
          ...(entities ?? {}),
        };

        return client.flag<T>(userContext, key, defaultValue);
      },
    };
  }

  return flagSyncAdapter;
}
