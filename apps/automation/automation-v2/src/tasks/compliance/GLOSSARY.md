# Compliance: flagging and enforcement

Keeps the addresses flagged on a ComplianceCheck in line with the sanction lists Temple follows, keeps Flagged Depositors out of Granary Auctions, and tells a human when that can't be done on its own.

## Lists

**Source**:
A publisher of addresses that must be flagged, such as OFAC SDN or a Manual source. A Source is not a list: it releases Publications.
_Avoid_: list, feed, provider

**Manual source**:
A Source whose entries a human curates by hand, to back flags no published list explains. Every entry carries a written reason. There may be several, one per kind of reason.
_Avoid_: extra list, overrides, acknowledged

**Publication**:
One release by a Source, identified by its version when the Source has one.
_Avoid_: update, version (for the release itself)

**Limits**:
The bounds a Publication must meet before it is accepted, such as a minimum size or a maximum drop since the last Snapshot.
_Avoid_: guards, thresholds

**Snapshot**:
The address set last accepted from a Source. A Publication that breaks the Limits is rejected, and the previous Snapshot stays.
_Avoid_: served list, cached list, current list

**Listed**:
Named in a Source's Snapshot. A Publication that was never accepted lists nothing.
_Avoid_: sanctioned, wanted, desired

**Exemption**:
A human decision, with a written reason, that a Listed address must not be flagged. It overrides every Source.
_Avoid_: allowlist, whitelist, override, acknowledged, retained

**Target set**:
The addresses Listed by any of a Deployment's Sources, minus Exemptions. A Deployment is in sync when exactly the Target set is Flagged.
_Avoid_: desired set

## Source states

**Absent**:
The Source has never produced a Snapshot. Absent is unknown, never empty.

**Fresh**:
The last check of the Source succeeded.
_Avoid_: current, healthy

**Failing**:
The last check of the Source failed, and its last Snapshot still stands.
_Avoid_: stale, degraded

**Rejected**:
The Source's latest Publication broke its Limits, and its last Snapshot still stands.

**Unconfirmed source**:
A Source with no successful check for longer than it is allowed, counted from its last successful check while Failing and from when it was first seen while Absent. A Rejected Source raises SourceRejected instead.
_Avoid_: stale source

## Chain

**ComplianceCheck**:
The contract that records which addresses are Flagged and which accounts are Flaggers. Every Auction points at one through `complianceCheck()`, and the Admin can repoint it.
_Avoid_: list, compliance list (when the contract is meant)

**Deployment**:
One ComplianceCheck on one network that the Bot keeps in sync. Its name is its identity: several Deployments can share a network, one per ComplianceCheck, named after the network for the first (`mainnet`) and with a suffix after that (`mainnet-2`).
_Avoid_: instance, contract (when the deployment is meant)

**Flagged**:
Marked by a Deployment's `isFlagged`. This is on-chain truth, as opposed to Listed.
_Avoid_: sanctioned, blocked, blacklisted

**Backed flag**:
A Flagged address that is in the Deployment's Target set.

**Unbacked flag**:
A Flagged address that is not in the Deployment's Target set: no Source lists it (Finding `UnbackedFlag`), or it is Exempt (Finding `ExemptFlag`).
_Avoid_: delisted, orphan

**Flagged addresses index**:
A local copy of a ComplianceCheck's Flagged set, rebuilt by the Bot from its `FlaggedSet` logs, because the contract can't enumerate it. It is used only to find flags no Source backs and to name re-flags.
_Avoid_: flag index, indexer, listing, reader, flagged accounts

**Watermark**:
The block up to which an index (the Flagged addresses index or a Depositor index) is complete.
_Avoid_: synced block, checkpoint

## Roles

**Flagger**:
The ComplianceCheck role allowed to flag and unflag addresses.

**Bot**:
The Overlord signer that holds the Flagger role.
_Avoid_: bot key, signer, overlord EOA, keeper

**Admin**:
The multisig with elevated access on ComplianceCheck and on every Granary Auction. On ComplianceCheck it grants the Flagger role; it or any Flagger can unflag. The Bot never does. On every Granary Auction it is the executor with elevated access: it calls `settleEarly` and `cancel`, and can `exclude` and `reinstate` like any active Flagger.
_Avoid_: msig, owner, governance

**Add-only**:
The policy that the Bot never undoes a compliance action: it never unflags and never reinstates, even though the Flagger role allows both.

## Auctions

**Auction**:
One Granary fixed-price auction whose ComplianceCheck is a Deployment's.
_Avoid_: sale, granary (for a single auction)

**Depositor**:
An account with a nonzero deposit in an Auction. An excluded balance doesn't make an account a Depositor.
_Avoid_: bidder, participant

**Depositor index**:
An eventually-consistent copy of every Auction's Depositors and excluded balances, from the network's Granary subgraph. It holds no flags.
_Avoid_: positions, subgraph (when the index is meant)

**Position**:
The Depositor index's record of one account in one Auction.

**Lagging depositor index**:
A Depositor index whose Watermark is too far behind the chain head.

**Exclusion**:
Moving a Flagged Depositor's whole deposit out of the Auction's fill, into a balance that can only be refunded. Only the account's current deposit counts; earlier Exclusions don't.
_Avoid_: ban, removal, freeze

**Exclusion window**:
The part of an Auction in which an Exclusion is possible: its Deposit and Fulfillment phases. It closes at `fulfillmentEnd`, or earlier if the Auction is settled early or cancelled.
_Avoid_: cutoff, deadline

**Missed exclusion**:
A Flagged Depositor with a filled, unclaimed deposit in a settled Auction that it was not excluded from. The account may have been flagged only after the Exclusion window closed, so nothing could have excluded it. The fill stands, and the account's claim stays frozen while it is Flagged. While the Depositor index is behind, an exclusion or claim it hasn't seen yet makes a false one, which resolves once the index catches up. See [SPEC § Troubleshooting MissedExclusion](./SPEC.md#troubleshooting-missedexclusion).
_Avoid_: leak, late exclusion

## Attention

**Finding**:
A condition that needs a human. It opens when first observed and resolves when its owner no longer observes it.
_Avoid_: alert, issue, incident

**Notice**:
A record that something happened, such as a Snapshot changing or the Bot flagging addresses. Nobody needs to act on it.
_Avoid_: alert, notification
