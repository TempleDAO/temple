import { assertNever } from '@/tlc/assert-never';
import type { Finding } from '../attention';
import { SourceState } from '../ingest';
import type { CuratedList, LCAddress } from '../shared';
import type { FlaggedAddressesIndexRead } from './flagged-addresses-index';

export interface TargetSet {
  /** The Target set: Listed by any Source, minus Exemptions. Sorted. */
  addresses: LCAddress[];
  /** Exempt addresses, including those of entries with no reason. Sorted. */
  exempt: LCAddress[];
  /**
   * `compliance_exemptions` entries with a problem: a bad address (exempts
   * nothing) or no reason (still exempts).
   */
  invalidExemptions: string[];
  /** The Deployment's Sources that are Absent. */
  absentSources: string[];
}

export const TargetSet = {
  /** The Target set and what it was built from. Pure. */
  from(
    sources: readonly { id: string; state: SourceState }[],
    exemptions: CuratedList
  ): TargetSet {
    // An entry with an address but no reason still exempts it: flagging it
    // could not be undone without the Admin.
    const exempt = new Set([
      ...exemptions.entries.map((e) => e.address),
      ...exemptions.invalid.flatMap((e) => (e.address ? [e.address] : [])),
    ]);
    const target = new Set<LCAddress>();
    for (const s of sources)
      for (const a of SourceState.snapshot(s.state)?.addresses ?? [])
        if (!exempt.has(a)) target.add(a);

    return {
      addresses: [...target].sort(),
      exempt: [...exempt].sort(),
      invalidExemptions: exemptions.invalid.map(
        (e) => `${e.entry} (${e.problem})`
      ),
      absentSources: sources.filter((s) => isAbsent(s.state)).map((s) => s.id),
    };
  },
};

/**
 * What to send and what needs a human, given `isFlagged` at the run's block
 * for the Target set, the Exemptions and the index's Flagged addresses.
 * Pure, and the only code that decides an address's fate:
 *
 * - in the Target set, not Flagged: the Bot flags it;
 * - Exempt and Flagged: UnbackedFlag;
 * - Flagged in the index, not in the Target set, not Exempt, and still
 *   Flagged: UnbackedFlag, but only while no Source is Absent, since
 *   "listed by no Source" can't be told apart from "Source unknown";
 * - anything else: nothing to do.
 *
 * Add-only: extra flags are Findings, never transactions.
 */
export function planFlags(
  target: TargetSet,
  index: FlaggedAddressesIndexRead,
  isFlagged: ReadonlySet<LCAddress>
): { toFlag: LCAddress[]; findings: Finding[] } {
  const inTarget = new Set(target.addresses);
  const exempt = new Set(target.exempt);
  const findings: Finding[] = [];

  for (const id of target.absentSources)
    findings.push({
      kind: 'SourceAbsent',
      key: id,
      summary: `${id} has no Snapshot yet; flagging from the other Sources, Flagged addresses index checks paused`,
    });

  for (const e of target.invalidExemptions)
    findings.push({
      kind: 'ExemptionInvalid',
      key: e,
      summary: `compliance_exemptions entry invalid: ${e}`,
    });

  for (const a of target.exempt)
    if (isFlagged.has(a))
      findings.push({
        kind: 'UnbackedFlag',
        key: a,
        summary: `${a} is Flagged but Exempt`,
      });

  if (!target.absentSources.length)
    for (const a of index.flagged)
      if (!inTarget.has(a) && !exempt.has(a) && isFlagged.has(a))
        findings.push({
          kind: 'UnbackedFlag',
          key: a,
          summary: `${a} is Flagged but no Source lists it`,
        });

  return {
    toFlag: target.addresses.filter((a) => !isFlagged.has(a)),
    findings,
  };
}

function isAbsent(state: SourceState): boolean {
  switch (state.status) {
    case 'absent':
      return true;
    case 'fresh':
    case 'failing':
    case 'rejected':
      return false;
    default:
      return assertNever(state);
  }
}
