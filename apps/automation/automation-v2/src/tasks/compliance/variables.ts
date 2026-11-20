import { JsonVariable, NumberVariable } from '@mountainpath9/overlord-core';

// Shared by every Deployment: the Manual source and the Exemptions are global, not per chain.

export const compliance_manual_source = new JsonVariable({
  name: 'compliance_manual_source',
  description:
    'The Manual source, as a JSON object of address → reason: {"0xabc…": "why it must be flagged"}. Every entry needs a non-empty reason. One invalid entry rejects the whole Publication, and the last Snapshot stands.',
});

export const compliance_exempt = new JsonVariable({
  name: 'compliance_exempt',
  description:
    'Exemptions, as a JSON object of address → reason: {"0xabc…": "why it must not be flagged"}. Addresses a Source lists that must not be flagged. Removed from the Target set, so the Bot never flags them. If one is flagged, the Admin unflags it (an UnbackedFlag finding says so). An entry with a bad address exempts nothing and raises ExemptionInvalid; an entry with a valid address but no reason still exempts it and raises ExemptionInvalid. A value that is not a JSON object fails every flag run until it is fixed; unset or null means no Exemptions.',
});

export const compliance_finding_reminder_secs = new NumberVariable({
  name: 'compliance_finding_reminder_secs',
  description:
    "Default reminder interval for open Findings whose kind uses 'default'. 0 disables those.",
  default: 15 * 60,
  min: 0,
});
