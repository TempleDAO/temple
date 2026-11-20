import { Address, isAddress } from 'viem';
import { z } from 'zod';

/** An ethereum address that is normalized to be lowercase */
export type LCAddress = Address & { __brand: 'LCAddress' };

export function lcAddress(address: Address): LCAddress {
  return address.toLowerCase() as LCAddress;
}

/** `<chainId>/<address>`: one contract's identity across chains, for keys and duplicate checks. */
export const chainAddressKey = (chainId: number, address: Address) =>
  `${chainId}/${lcAddress(address)}`;

/** A string read from outside (KV, a subgraph) that must be an address. */
export const lcAddressSchema = z
  .string()
  .refine((a): a is Address => isAddress(a, { strict: false }))
  .transform(lcAddress);
