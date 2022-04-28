import { differenceInSeconds } from 'date-fns';
import { Entry, Vault, MarkerType } from '../types';

export const SECONDS_IN_MONTH = 60 * 60 * 24 * 30;

export const createVault = (originalData: any): Vault => {
  const data = { ...originalData }; // shallow copy

  // All timestamps are in seconds and need to be converted to MS.
  data.startDate = new Date(Number(data.firstPeriodStartTimestamp) * 1000);
  // The current timestamp
  data.now = new Date(Date.now());
  // periodDuration is the number of months.
  data.months = Number(data.periodDuration) / SECONDS_IN_MONTH;
  data.tvl = Number(data.tvl);
  data.currentCycle = getCurrentCycle(data.startDate, data.months, data.now);

  const deposits = (data.users?.[0]?.deposits || []);
  data.entries = deposits.map((e: any) => {
    const entry = { ...e }; // shallow copy
    // Convert to milliseconds
    entry.entryDate = new Date((Number(entry.timestamp) * 1000));
    entry.percent = calculatePercent(entry, data);
    entry.inZone = calculateInZone(entry, data);
    entry.type = calculateEntryType(entry);
    entry.currentCycle = getCurrentCycle(
      entry.entryDate,
      data.months,
      data.now
    );
    return entry;
  });

  maybeInsertEmptyMarker(data);
  return data;
};

// If there is no other marker currently in the zone
// (because it cycled), then we should show the empty "Enter" marker
const maybeInsertEmptyMarker = (vault: Vault) => {
  const zoneEmpty = !vault.entries.some(({ inZone }) => inZone);
  vault.zoneEmpty = zoneEmpty;
  if (zoneEmpty) {
    const emptyEntry: Entry = {
      id: 'empty',
      inZone: true,
      type: MarkerType.EMPTY,
    };
    emptyEntry.percent = calculateEmptyPercent(vault);
    vault.entries.push(emptyEntry);
  }
};

// we treat the zone the same as a "percent", so the calculations for it are the same
// and we use the percent value as a comparison to determine if we're in or out of the zone
const calculateInZone = (entry: Entry, vault: Vault) => {
  const zonePercent = 1 / vault.months;
  return entry.percent! < zonePercent;
};

// returns enum of EMPTY | STAKING | ZONE
const calculateEntryType = (entry: Entry) => {
  return entry.inZone ? MarkerType.ZONE : MarkerType.STAKING;
};

// Calculate percet based on now to marker end of cycle
const calculatePercent = (entry: Entry, vault: Vault) => {
  const now = vault.now;
  const entryStartDate = entry.entryDate!;
  const diff = differenceInSeconds(now, entryStartDate);
  if (diff < 0) {
    console.error(
      'Data Error: Current date is less than entry date',
      entry,
      vault
    );
  }
  const totalSecondsThisCycle = SECONDS_IN_MONTH * vault.months;
  const secondsIntoThisCycle = diff % totalSecondsThisCycle;
  const percent = secondsIntoThisCycle / totalSecondsThisCycle;
  return percent;
};

// Calculate percet based on now to marker end of cycle
const calculateEmptyPercent = (vault: Vault) => {
  const secondsSinceVaultStart = differenceInSeconds(
    vault.now,
    vault.startDate
  );
  if (secondsSinceVaultStart < 0) {
    console.error('Data Error: Current date is less than entry date', vault);
  }
  const totalSecondsThisCycle = SECONDS_IN_MONTH * vault.months;
  const secondsIntoThisCycle = secondsSinceVaultStart % totalSecondsThisCycle;
  const secondsIntoZone = secondsIntoThisCycle % SECONDS_IN_MONTH;
  const percent = secondsIntoZone / totalSecondsThisCycle;

  return percent;
};

// how many cycles since the vault started:
// months_since_start = seconds_since_vault_start / seconds_in_months
// cycles_since_start = floor(months_since_start / vault_months)
const getCurrentCycle = (startDate: Date, numMonths: number, now: Date) => {
  const monthsSinceStart =
    differenceInSeconds(now, startDate) / SECONDS_IN_MONTH;
  const cyclesSinceStart = Math.floor(monthsSinceStart / numMonths);

  return cyclesSinceStart;
};

// calculates the value that is at X% distance between A and B
// ex, half way between 2 and 8 is 5.. lerp(2,8,0.5)=5
// we use this to figure out the angle between the start and
// end of the timeline. Start being at -72 (or whatever) and end being at 72 (degrees)
// so if we know a marker is 15% into a cycle, then we know what degree to
// put it at.
export const lerp = (v0: number, v1: number, t: number) =>
  v0 * (1 - t) + v1 * t;
