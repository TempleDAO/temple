import { expect, test } from 'vitest';
import type { TaskContext } from '@mountainpath9/overlord-core';
import { manualSource } from './manual';

test('a compliance_manual_source that is not a JSON object is one refused entry, which rejects the Publication', async () => {
  const ctx = {
    config: {
      get: async (name: string) =>
        name === 'compliance_manual_source'
          ? ['0x00000000000000000000000000000000000000aa']
          : undefined,
    },
  } as unknown as TaskContext;
  expect(await manualSource.fetch(ctx)).toEqual({
    addresses: [],
    invalid: ['not a JSON object of address → reason'],
  });
});
