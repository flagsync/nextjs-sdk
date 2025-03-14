import { FsUserContext } from '@flagsync/node-sdk';
import { Identify } from '@vercel/flags';

type ExtractParams<T> = T extends (params: infer P) => any ? P : never;

export const createIdentify =
  (
    callback: (
      params: ExtractParams<Identify<FsUserContext>>,
    ) => Promise<FsUserContext> | FsUserContext,
  ): Identify<FsUserContext> =>
  (params) =>
    callback(params);
