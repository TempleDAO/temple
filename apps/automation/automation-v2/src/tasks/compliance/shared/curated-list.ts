import type { Json } from '@mountainpath9/overlord-core';
import { z } from 'zod';
import { LCAddress, lcAddressSchema } from './address';

/** A hand-curated entry: an address and the human-written reason for it. */
type CuratedEntry = { address: LCAddress; reason: string };

/** An entry refused, with why. `address` is set when its key is one. */
type InvalidEntry = {
  entry: string;
  problem: 'not an address' | 'no reason';
  address?: LCAddress;
};

export type CuratedList = {
  entries: CuratedEntry[];
  invalid: InvalidEntry[];
};

export const CuratedList = {
  /** What a hand-curated list's value must be, for messages. */
  FORMAT: 'a JSON object of address → reason',

  /**
   * Parses a hand-curated list, an Overlord variable whose value is
   * `CuratedList.FORMAT`. Unset or null is empty. A value set to anything
   * else is `'malformed'`: each caller decides what that means. Each entry
   * stands alone: its key must be an address and its value a non-empty
   * reason, or it goes into `invalid`. One bad entry never rejects the
   * others.
   */
  parse(value: Json | undefined): CuratedList | 'malformed' {
    if (value === undefined || value === null)
      return { entries: [], invalid: [] };
    const list = listSchema.safeParse(value);
    if (!list.success) return 'malformed';

    const entries: CuratedEntry[] = [];
    const invalid: InvalidEntry[] = [];
    for (const [key, value] of Object.entries(list.data)) {
      const address = lcAddressSchema.safeParse(key);
      const reason = reasonSchema.safeParse(value);
      if (!address.success)
        invalid.push({ entry: key, problem: 'not an address' });
      else if (!reason.success)
        invalid.push({
          entry: key,
          problem: 'no reason',
          address: address.data,
        });
      else entries.push({ address: address.data, reason: reason.data });
    }
    return { entries, invalid };
  },
};

const listSchema = z.record(z.unknown());

const reasonSchema = z.string().trim().min(1);
