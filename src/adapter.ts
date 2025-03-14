import { FlagSyncFactory, type FsUserContext } from '@flagsync/node-sdk';
import type { Adapter } from '@vercel/flags';

import { FsEntitiesType } from './types';

export function createFlagSyncAdapter(sdkKey: string) {
  const factory = FlagSyncFactory({
    sdkKey,
    metadata: {
      sdkName: '__SDK_NAME__',
      sdkVersion: '__SDK_VERSION__',
    },
  });

  const client = factory.client();

  return function flagSyncAdapter<ValueType>(): Adapter<
    ValueType,
    FsEntitiesType<ValueType>
  > {
    return {
      initialize: () => client.waitForReady(),
      origin(flagId) {
        return `https://www.flagsync.com/dashboard/flags/${flagId}`;
      },
      async decide({ key, entities }) {
        const userContext: FsUserContext = entities?.context
          ? entities.context
          : { key: 'anonymous' };

        const flagValue = client.flag(userContext, key);
        return flagValue as ValueType;
      },
    };
  };
}
