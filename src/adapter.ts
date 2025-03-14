import {
  FlagSyncFactory,
  type FsUserContext,
  type FsConfig,
  FsClient,
} from '@flagsync/node-sdk';
import type { Adapter } from '@vercel/flags';

/**
 * Create the FlagSync client. This should be created once as a singleton
 * in your application, and passes to each "createFlagSyncAdapter" you
 * create per flag.
 * @param config
 */
export function createFlagSyncClient(config: FsConfig): FsClient {
  const instance =  FlagSyncFactory({
    ...config,
    metadata: {
      sdkName: '__SDK_NAME__',
      sdkVersion: '__SDK_VERSION__',
    },
  })
  return instance.client()
}


export function createFlagSyncAdapter(client: FsClient) {

  let isReady = false;
  const ensureReady = async () => {
    if (!isReady) {
      await client.waitForReady();
      isReady = true;
    }
  };

  return function flagSyncAdapter<ValueType>(): Adapter<
    ValueType,
    FsUserContext
  > {
    return {
      async decide({ key, entities }) {
        await ensureReady()

        const userContext: FsUserContext = {
          key: 'anonymous',
          ...entities ?? {},
        };

        const flagValue = client.flag<ValueType>(userContext, key);

        /**
         * The "decide" function’s return type is strictly typed as ValueType | Promise<ValueType>,
         * meaning it expects a concrete value (or a promise resolving to one) and doesn’t allow undefined.
         * However, the defaultValue defined on the adaptor configuration will only return if
         * "decide" throws, or returns undefined, so we have to cast "undefined as ValueType"
         * to satisfy TypeScript.
         *
         * "client.flag" does take a third argument, which can serve as the default value, but we're
         * relying on the adaptor configuration instead.
         */
        if (flagValue === 'control') {
          return undefined as ValueType;
        }

        return flagValue as ValueType
      },
    };
  };
}
