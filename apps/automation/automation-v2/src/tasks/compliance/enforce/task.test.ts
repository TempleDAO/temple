import { expect, test } from 'vitest';
import { encodeErrorResult, Hex } from 'viem';
import { ABI as CommonEventsAndErrorsAbi } from '@/abi/CommonEventsAndErrors';
import { ABI as FixedPriceAuctionAbi } from '@/abi/IFixedPriceAuction';
import { decodeExcludeRevert } from './task';

const ALICE = '0x00000000000000000000000000000000000000A1';

test.each([
  [
    'an Auction error',
    encodeErrorResult({
      abi: FixedPriceAuctionAbi,
      errorName: 'AccountNotFlagged',
      args: [ALICE],
    }),
    'AccountNotFlagged',
  ],
  [
    'a CommonEventsAndErrors error, which the interface ABI leaves out',
    encodeErrorResult({
      abi: CommonEventsAndErrorsAbi,
      errorName: 'ExpectedNonZero',
    }),
    'ExpectedNonZero',
  ],
  ['unknown revert data, kept raw', '0xdeadbeef' as Hex, '0xdeadbeef'],
])('decodes %s', (_, data, error) => {
  expect(decodeExcludeRevert(data).revert).toBe(error);
});
