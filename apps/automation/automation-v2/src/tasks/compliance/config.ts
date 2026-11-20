import type { TaskContext } from '@mountainpath9/overlord-core';
import type { TxSubmissionParams } from '@mountainpath9/overlord-viem';
import type { Address, Chain } from 'viem';
import { sepolia } from 'viem/chains';
import { getMainnetSubmissionParams } from '@/config';
import { GRANARY_SEPOLIA } from '@/tasks/granary/config';
import type { FlaggedAddressesIndexConfig } from './flag';
import type { SourceId } from './ingest';

/**
 * A Deployment: one ComplianceCheck the Bot keeps in sync. Each gets its
 * own `compliance-flag-<name>` task; sources are ingested once and shared.
 *
 * The ComplianceCheck is fixed here, not discovered from the Auctions: the
 * Bot can only act on a ComplianceCheck whose Admin made it a Flagger, and
 * following `setComplianceCheck` would let whoever repoints an Auction steer
 * the Bot. Moving Auctions to a new ComplianceCheck means adding a
 * Deployment for it, and keeping the old one while any Auction still points
 * at it. Enforce raises AuctionComplianceCheckUnserved for an Auction whose
 * ComplianceCheck no Deployment enforces.
 */
export interface ComplianceDeployment {
  /**
   * The Deployment's identity: task ids (`compliance-flag-<name>`) and
   * Finding owners (`flag:<name>`) are keyed by it, so it must be unique
   * and stay stable. The network's name for its first ComplianceCheck
   * (`mainnet`), then a suffix for the next (`mainnet-2`).
   */
  name: string;
  chain: Chain;
  complianceCheck: Address;
  /** Overlord signer id of the Bot, a Flagger on `complianceCheck`. */
  signerId: string;
  /** Sources whose Listed addresses, minus Exemptions, are the Target set. */
  sourceIds: readonly SourceId[];
  /**
   * Send through `mev_protected_provider_url_<chainId>` (Overlord's
   * getMevProtectedWalletClient) instead of the public mempool.
   */
  privateSubmission: boolean;
  submissionParams(ctx: TaskContext): Promise<TxSubmissionParams>;
  /** How the Bot scans `complianceCheck`'s `FlaggedSet` logs into its Flagged addresses index. */
  flaggedAddressesIndex: Pick<
    FlaggedAddressesIndexConfig,
    'deployBlock' | 'confirmations'
  >;
  /**
   * The network's Granary subgraph, read as the Depositor index. Setting it
   * enables `compliance-enforce-<name>`; unset, the Deployment only flags.
   */
  depositorIndex?: DepositorIndexConfig;
}

export interface DepositorIndexConfig {
  /** A Granary subgraph version with Positions and each Auction's `complianceCheck`. */
  subgraphUrl: string;
  /**
   * The genuine FixedPriceAuction factory. Only its Auctions that point at
   * this Deployment's ComplianceCheck are enforced.
   */
  factory: Address;
}

/** A Deployment with a Depositor index: one that enforce runs for. */
export type EnforcingDeployment = ComplianceDeployment & {
  depositorIndex: DepositorIndexConfig;
};

/**
 * The Sepolia ComplianceCheck, which the Granary factory's Auctions are
 * created with. Flags and enforces once the Admin has made the Bot
 * (`signerId`) a Flagger; until then every send reverts and the flag task
 * fails.
 */
export const COMPLIANCE_SEPOLIA: ComplianceDeployment = {
  name: 'sepolia',
  chain: sepolia,
  complianceCheck: GRANARY_SEPOLIA.contracts.COMPLIANCE_CHECK,
  signerId: 'compliance_flagger_signer',
  sourceIds: ['ofac-sdn', 'manual'],
  privateSubmission: false,
  submissionParams: getMainnetSubmissionParams,
  // Deployed in 0xc58c8790ed861cc01d71852098fed6604069415cb6702bdb35d5e36a46aaa64a.
  flaggedAddressesIndex: { deployBlock: 12_023_391n, confirmations: 12n },
  depositorIndex: {
    subgraphUrl: GRANARY_SEPOLIA.subgraphUrl,
    factory: GRANARY_SEPOLIA.contracts.FIXED_PRICE_AUCTION_FACTORY,
  },
};

/** Deployments the production runner serves. */
export const COMPLIANCE_DEPLOYMENTS: readonly ComplianceDeployment[] = [
  COMPLIANCE_SEPOLIA,
];
