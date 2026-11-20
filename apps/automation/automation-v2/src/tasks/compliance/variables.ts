import { NumberVariable } from '@mountainpath9/overlord-core';

export const compliance_finding_reminder_secs = new NumberVariable({
  name: 'compliance_finding_reminder_secs',
  description:
    "Default reminder interval for open Findings whose kind uses 'default'. 0 disables those.",
  default: 15 * 60,
  min: 0,
});
