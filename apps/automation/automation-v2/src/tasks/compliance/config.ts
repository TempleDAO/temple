import type { TaskContext } from '@mountainpath9/overlord-core';
import type { TxSubmissionParams } from '@mountainpath9/overlord-viem';
import type { Address, Chain } from 'viem';
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

