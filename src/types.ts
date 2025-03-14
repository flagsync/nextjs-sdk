import { FsUserContext } from '@flagsync/node-sdk';

export type FsEntitiesType<ValueType> = {
  context: FsUserContext;
  defaultValue: ValueType;
}
