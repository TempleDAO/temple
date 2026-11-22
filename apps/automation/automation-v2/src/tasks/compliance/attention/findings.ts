/**
 * Everything that needs a human, as data.
 *
 * Every message a task posts is a Finding or a Notice. Tasks never post a
 * Notice about a condition that needs a human. They report findings
 * during a run; at the end of the run `reconcileFindings` compares them
 * with the owner's open findings and decides what to post.
 */

import type { NotificationLevel } from '@/utils/discord';

export type FindingKind = keyof typeof FINDING_KINDS;

/**
 * How a Finding kind is posted. `remindEverySecs: 'default'` uses
 * `compliance_finding_reminder_secs`; 0 never reminds.
 */
type FindingKindSpec = {
  level: NotificationLevel;
  remindEverySecs: number | 'default';
  action: string;
};

/**
 * Who owns a finding. Only the owner's runs open or resolve it, so one
 * task never clears another task's findings.
 */
export type FindingOwner =
  | `ingest:${string}`
  | `flag:${string}`
  | `enforce:${string}`
  | `flagger-check:${string}`;

/** One condition a run observed. `kind` + `key` identify it across runs. */
// Type aliases, not interfaces, so open findings are assignable to Overlord's Json.
export type Finding = {
  kind: FindingKind;
  /**
   * What it is about: an address, a Source id, an Auction, an
   * `auction:account` pair, an invalid entry, or '' for the owner itself.
   */
  key: string;
  /** Current detail for humans. May change while the finding stays open. */
  summary: string;
};

/** A finding that is open, as persisted per owner. */
export type OpenFinding = Finding & {
  openedAtMs: number;
  lastPostedAtMs: number;
};

/** Persisted per owner: finding id → open finding. */
export type OpenFindings = Record<string, OpenFinding>;

export interface Reconciled {
  next: OpenFindings;
  opened: OpenFinding[];
  reminded: OpenFinding[];
  resolved: OpenFinding[];
}

/**
 * Every kind of finding and what a human should do about it. This table is
 * the complete answer to "what can need attention". Add a kind here first.
 */
export const FINDING_KINDS = {
  SourceUnconfirmed: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'A Source has had no successful check for too long. Its last Snapshot still stands. Check the publisher or the network.',
  },
  SourceRejected: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'A Publication broke its Limits (invalid entry, too few addresses, too large a drop). The last Snapshot still stands. Inspect the Source, then fix the data or the Limits.',
  },
  SourceAbsent: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'A Source this Deployment uses has never produced a Snapshot. The Bot flags what the other Sources list, but UnbackedFlag checks against the Flagged addresses index are paused.',
  },
  UnbackedFlag: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'Flagged, but not in the Target set: no Source lists it, or it is Exempt. The Bot never unflags. Back it by adding it to a Manual source, or the Admin unflags it.',
  },
  FlaggedAddressesIndexFailing: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'The Flagged addresses index scan failed (an RPC error such as an eth_getLogs range cap, or a stored index that no longer parses). Flagging continues; UnbackedFlag checks against the index and re-flag names are paused. Fix the RPC provider or the stored index.',
  },
  ExemptionInvalid: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'An entry in compliance_exemptions is invalid. A bad address exempts nothing; a valid address with no reason still exempts it. Add the reason or fix the address.',
  },
  ExclusionFailed: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'The Bot could not exclude a Flagged Depositor from an Auction. Before fulfillmentEnd, and before any settleEarly: fix the cause (Flagger role, rescue mode, repointed ComplianceCheck), or the Admin excludes by hand.',
  },
  AuctionComplianceCheckUnenforced: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'An Auction of the factory points at a ComplianceCheck no Deployment enforces, so nobody excludes its Flagged Depositors. Before fulfillmentEnd: add a Deployment for that ComplianceCheck (the Admin makes the Bot a Flagger on it), or the Admin repoints the Auction.',
  },
  DepositorIndexLagging: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'The Depositor index (the Granary subgraph) Watermark is too far behind head. Fix the Granary subgraph. Exclusions may be late, never wrong.',
  },
  MissedExclusion: {
    level: 'defcon3',
    // It can't resolve while the account is Flagged, so a daily reminder is enough.
    remindEverySecs: 24 * 60 * 60,
    action:
      'A Flagged account has a filled, unclaimed deposit in a settled Auction that it was not excluded from. It may have been flagged after the Exclusion window closed, or the Depositor index may be behind (a false positive). See SPEC.md § Troubleshooting MissedExclusion. The fill stands and the claim stays frozen while the account is Flagged.',
  },
  ReinstateAvailable: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      'An excluded account is no longer Flagged while its Auction is in Deposit. The Admin reinstates it before Deposit ends if appropriate, or leaves it: the account can withdraw its excluded balance. The Bot never reinstates.',
  },
  BotNotFlagger: {
    level: 'defcon3',
    remindEverySecs: 'default',
    action:
      "The Bot (the Deployment's signer) is not a Flagger on its ComplianceCheck, so every setFlagged and exclude will revert. The Admin calls setFlagger(<Bot address>, true) on the ComplianceCheck, or confirms the removal was intended.",
  },
} as const satisfies Record<string, FindingKindSpec>;

/** The level every Notice is posted at. */
export const NOTICE_LEVEL: NotificationLevel = 'defcon5';

export const Finding = {
  /** A Finding's identity within its owner: one open Finding per id. */
  id: (f: Pick<Finding, 'kind' | 'key'>) => `${f.kind}:${f.key}`,
};

/** Collects findings while a run proceeds. Reporting the same id twice keeps the last summary. */
export class FindingSink {
  private readonly byId = new Map<string, Finding>();

  report(finding: Finding): void {
    this.byId.set(Finding.id(finding), finding);
  }

  all(): Finding[] {
    return [...this.byId.values()];
  }
}

/**
 * The Finding lifecycle: not open → Open → resolved (removed).
 *
 * - A completed run's findings are the whole truth for its owner: new ones
 *   open, missing ones resolve, the rest stay open. A run that throws never
 *   gets here, so it changes nothing.
 * - An open finding is posted again after its kind's `remindEverySecs`
 *   (`'default'` = `defaultReminderSecs`; 0 = never).
 */
export function reconcileFindings(
  prev: OpenFindings,
  current: readonly Finding[],
  nowMs: number,
  defaultReminderSecs: number
): Reconciled {
  const next: OpenFindings = {};
  const opened: OpenFinding[] = [];
  const reminded: OpenFinding[] = [];

  for (const f of current) {
    const id = Finding.id(f);
    const before = prev[id];
    if (!before) {
      next[id] = { ...f, openedAtMs: nowMs, lastPostedAtMs: nowMs };
      opened.push(next[id]);
      continue;
    }
    const remindEverySecs: FindingKindSpec['remindEverySecs'] =
      FINDING_KINDS[f.kind].remindEverySecs;
    const reminderSecs =
      remindEverySecs === 'default' ? defaultReminderSecs : remindEverySecs;
    const due =
      reminderSecs > 0 && nowMs - before.lastPostedAtMs >= reminderSecs * 1000;
    next[id] = {
      ...f,
      openedAtMs: before.openedAtMs,
      lastPostedAtMs: due ? nowMs : before.lastPostedAtMs,
    };
    if (due) reminded.push(next[id]);
  }

  const resolved = Object.entries(prev)
    .filter(([id]) => !(id in next))
    .map(([, f]) => f);

  return { next, opened, reminded, resolved };
}
