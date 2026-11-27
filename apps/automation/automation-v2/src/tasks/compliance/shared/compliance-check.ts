import type { getPublicClient } from '@mountainpath9/overlord-viem';
import type { Address } from 'viem';
import { ABI as ComplianceCheckAbi } from '@/abi/IComplianceCheck';
import type { LCAddress } from './address';

/** Overlord's viem public client for one chain. */
export type PublicClient = Awaited<ReturnType<typeof getPublicClient>>;

/**
 * Of `accounts`, those `isFlagged` on `complianceCheck` at `atBlock`, in
 * one multicall. Any failed call fails the read.
 */
export async function readIsFlagged(
  pclient: PublicClient,
  complianceCheck: Address,
  accounts: readonly LCAddress[],
  atBlock: bigint
): Promise<Set<LCAddress>> {
  const flags = await pclient.multicall({
    contracts: accounts.map(
      (a) =>
        ({
          address: complianceCheck,
          abi: ComplianceCheckAbi,
          functionName: 'isFlagged',
          args: [a],
        }) as const
    ),
    allowFailure: false,
    batchSize: IS_FLAGGED_BATCH_BYTES,
    blockNumber: atBlock,
  });
  return new Set(accounts.filter((_, i) => flags[i]));
}

/**
 * About 500 `isFlagged` calls per `eth_call`, well under common gas caps.
 * viem's `batchSize` counts calldata bytes, and each call is 36 bytes
 * (selector + address).
 */
const IS_FLAGGED_BATCH_BYTES = 500 * 36;
