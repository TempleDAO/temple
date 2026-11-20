import type { Json } from '@mountainpath9/overlord-core';
import { CuratedList } from '../../shared';
import { compliance_manual_source } from '../../variables';
import type { ComplianceSource, SourceFetch } from './types';

/**
 * The Manual source: addresses a human enters by hand in the
 * `compliance_manual_source` variable, each with a reason. An entry without
 * a reason makes the Publication invalid, so every flag the Manual source
 * backs has a human-written explanation. Its job is to back flags no other
 * Source explains. Reading config is as cheap as any version check, so it
 * has no `latestVersion()` and is fetched every run; the framework's
 * content hash tells whether it changed.
 */
export const manualSource: ComplianceSource = {
  id: 'manual',
  description: 'Manual source (compliance_manual_source)',
  limits: {
    minCount: 0,
    // A human may remove entries on purpose. The Bot is add-only, so a
    // smaller Snapshot never unflags; it only raises UnbackedFlag Findings.
    maxDropPerPublication: Number.MAX_SAFE_INTEGER,
    unconfirmedAfterSecs: 10 * 60,
  },
  versioned: false,
  async fetch(ctx) {
    return manualFetch(await compliance_manual_source.getValue(ctx));
  },
};

/**
 * The Manual source's fetch, from the raw `compliance_manual_source` value
 * (a JSON object address → reason): entries without an address or a
 * reason are refused. A value that isn't such an object is one refused
 * entry, so the Publication is rejected and the last Snapshot stands.
 */
function manualFetch(raw: Json | undefined): SourceFetch {
  const list = CuratedList.parse(raw);
  if (list === 'malformed')
    return { addresses: [], invalid: [`not ${CuratedList.FORMAT}`] };
  return {
    addresses: list.entries.map((e) => e.address),
    invalid: list.invalid.map((e) => `${e.entry} (${e.problem})`),
  };
}
