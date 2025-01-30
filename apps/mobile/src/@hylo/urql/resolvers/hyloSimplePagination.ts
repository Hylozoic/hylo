/*

Modification of https://github.com/urql-graphql/urql/blob/main/exchanges/graphcache/src/extras/simplePagination.ts
to support our *QuerySet formats.
Keep in TypeScript so it is easy to diff with the source

*/

import { stringifyVariables } from '@urql/core';
import type { Resolver, Variables, NullArray } from '@urql/exchange-graphcache'

export type MergeMode = 'before' | 'after';

/** Input parameters for the {@link simplePagination} factory. */
export interface PaginationParams {
  /** The name of the field argument used to define the page’s offset. */
  offsetArgument?: string;
  /** The name of the field argument used to define the page’s length. */
  limitArgument?: string;
  /** Flip between forward and backwards pagination.
   *
   * @remarks
   * When set to `'after'`, its default, pages are merged forwards and in order.
   * When set to `'before'`, pages are merged in reverse, putting later pages
   * in front of earlier ones.
   */
  mergeMode?: MergeMode;
}

export const hyloSimplePagination = ({
  offsetArgument = 'skip',
  limitArgument = 'limit',
  mergeMode = 'after',
}: PaginationParams = {}): Resolver<any, any, any> => {
  const compareArgs = (
    fieldArgs: Variables,
    connectionArgs: Variables
  ): boolean => {
    for (const key in connectionArgs) {
      if (key === offsetArgument || key === limitArgument) {
        continue;
      } else if (!(key in fieldArgs)) {
        return false;
      }

      const argA = fieldArgs[key];
      const argB = connectionArgs[key];

      if (
        typeof argA !== typeof argB || typeof argA !== 'object'
          ? argA !== argB
          : stringifyVariables(argA) !== stringifyVariables(argB)
      ) {
        return false;
      }
    }

    for (const key in fieldArgs) {
      if (key === offsetArgument || key === limitArgument) {
        continue;
      }
      if (!(key in connectionArgs)) return false;
    }

    return true;
  };

  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info;

    const allFields = cache.inspectFields(entityKey);
    const fieldInfos = allFields.filter(info => info.fieldName === fieldName);
    const size = fieldInfos.length;
    if (size === 0) {
      return undefined;
    }

    const visited = new Set();
    let result: NullArray<string> = [];
    let prevOffset: number | null = null;

    for (let i = 0; i < size; i++) {
      const { fieldKey, arguments: args } = fieldInfos[i];
      if (args === null || !compareArgs(fieldArgs, args)) {
        continue;
      }

      const postField = cache.resolve(entityKey, fieldKey);
      // Look inside `items` array
      const links = cache.resolve(postField as string, 'items') as string[];

      const currentOffset = args[offsetArgument];

      if (
        links === null ||
        links.length === 0 ||
        typeof currentOffset !== 'number'
      ) {
        continue;
      }

      const tempResult: NullArray<string> = [];

      for (let j = 0; j < links.length; j++) {
        const link = links[j];
        if (visited.has(link)) continue;
        tempResult.push(link);
        visited.add(link);
      }

      if (
        (!prevOffset || currentOffset > prevOffset) ===
        (mergeMode === 'after')
      ) {
        result = [...result, ...tempResult];
      } else {
        result = [...tempResult, ...result];
      }

      prevOffset = currentOffset;
    }

    const hasCurrentPage = cache.resolve(entityKey, fieldName, fieldArgs);

    const inferredTypename = cache.resolve(hasCurrentPage as string, '__typename') as string;
    const total = cache.resolve(hasCurrentPage as string, 'total') as number;
    const hasMore = cache.resolve(hasCurrentPage as string, 'hasMore') as boolean;

    if (hasCurrentPage) {
      return {
        __typename: inferredTypename,
        items: result,
        total,
        hasMore
      };
    } else if (!(info as any).store.schema) {
      return undefined;
    } else {
      info.partial = true;
      return {
        __typename: inferredTypename,
        items: result,
        total,
        hasMore
      };
    }
  };
};

export default hyloSimplePagination;
