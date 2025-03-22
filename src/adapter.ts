import {
  FlagSyncFactory,
  FsClient,
  type FsConfig,
  type FsUserContext,
} from '@flagsync/node-sdk';
import type { Adapter } from '@vercel/flags';

import { JsonObject } from './types';

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
   * Creates a typed adapter instance for a specific flag value type.
   */
  return function flagSyncAdapter<ValueType>(): Adapter<
    ValueType,
    FsUserContext
  > {
    return {
      /**
       * Evaluates a feature flag for a given context and returns its value.
       */
      async decide({ key, entities }) {
        await ensureReady();

        const userContext: FsUserContext = {
          key: 'anonymous',
          ...(entities ?? {}),
        };

        return client.flag<ValueType>(userContext, key);
      },
    };
  };
}

/** Creates an adapter for string-typed flags */
export const createStringFlagAdaptor = (
  client: FsClient,
): Adapter<string, FsUserContext> => createFlagSyncAdapter(client)<string>();

/** Creates an adapter for boolean-typed flags */
export const createBoolFlagAdaptor = (
  client: FsClient,
): Adapter<boolean, FsUserContext> => createFlagSyncAdapter(client)<boolean>();

/** Creates an adapter for number-typed flags */
export const createNumberFlagAdaptor = (
  client: FsClient,
): Adapter<number, FsUserContext> => createFlagSyncAdapter(client)<number>();

/** Creates an adapter for JSON object-typed flags */
export const createJsonFlagAdaptor = (
  client: FsClient,
): Adapter<JsonObject, FsUserContext> =>
  createFlagSyncAdapter(client)<JsonObject>();
