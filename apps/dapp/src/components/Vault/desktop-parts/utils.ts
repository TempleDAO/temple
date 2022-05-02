import { differenceInSeconds, addSeconds } from 'date-fns';

import { GraphVault, GraphVaultGroup } from 'hooks/core/types';
import { Entry, Vault, VaultGroup, MarkerType } from '../types';

export const SECONDS_IN_MONTH = 60 * 60 * 24 * 30;

export const createVaultGroup = (subgraphVaultGroup: GraphVaultGroup): VaultGroup => {
  const vaults = subgraphVaultGroup.vaults.map((vault) => createVault(vault));
  const orderedVaults = vaults.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const { startDate, endDate, months } = orderedVaults[0];

  return {
    ...subgraphVaultGroup,
    name: subgraphVaultGroup.id,
    vaults: orderedVaults,
    startDate,
    endDate,
    months,
  };
}

// return numCylces * periodDuration + firstPeriodStartTimestamp + enterExitWindowDuration > block.timestamp;

export const createVault = (subgraphVault: GraphVault): Vault => {
  const startDate = new Date(Number(subgraphVault.firstPeriodStartTimestamp) * 1000);

  // The current timestamp
  const now = new Date(Date.now());
  // periodDuration is the number of months.
  const months = Number(subgraphVault.periodDuration) / SECONDS_IN_MONTH;

  const durationSeconds = months * SECONDS_IN_MONTH;
  const endDate = addSeconds(startDate, durationSeconds);

  const tvl = Number(subgraphVault.tvl);
  const currentCycle = getCurrentCycle(startDate, months, now);
  const inZone = calculateInZoneVaultInstance(startDate, months);
  
  const entries = (subgraphVault.users?.[0]?.vaultUserBalances || []).map((balance) => {
    // Convert to milliseconds
    const entryDate = new Date((Number(balance.timestamp) * 1000));
    const percent = calculatePercent(now, endDate, months);
    const inZone = calculateInZone(percent, months);
    const type = calculateEntryType(inZone);
    const currentCycle = getCurrentCycle(
      entryDate,
      months,
      now,
    );

    return {
      id: balance.id,
      entryDate,
      percent,
      inZone,
      type,
      currentCycle,
      value: balance.value,
      amount: balance.amount,
    };
  });

  const vault = {
    id: subgraphVault.id,
    startDate,
    now,
    months,
    tvl,
    currentCycle,
    entries,
    endDate,
    inZone,
  };

  maybeInsertEmptyMarker(vault);
  
  return vault;
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
      amount: '',
      value: '',
    };
    emptyEntry.percent = calculateEmptyPercent(vault);
    vault.entries.push(emptyEntry);
  }
};

const calculateInZoneVaultInstance = (startDate: Date, months: number) => {
  const periodDuration = SECONDS_IN_MONTH;
  const nowSeconds = new Date(Date.now()).getTime() / 1000;
  const startSeconds = startDate.getTime() / 1000;
  return months * periodDuration + startSeconds > nowSeconds;
};

// we treat the zone the same as a "percent", so the calculations for it are the same
// and we use the percent value as a comparison to determine if we're in or out of the zone
//
// Note: the following is the logic found inside the vault contract for determining if in enterExit window.
// return numCylces * periodDuration + firstPeriodStartTimestamp + enterExitWindowDuration > block.timestamp;
//
const calculateInZone = (entryPercent: number, months: number) => {
  // TODO: do we want to have a period duratio of something other than a month ever?
  const zonePercent = 1 / months;
  return entryPercent! < zonePercent;
};

// returns enum of EMPTY | STAKING | ZONE
const calculateEntryType = (entryInZone: boolean) => {
  return entryInZone ? MarkerType.ZONE : MarkerType.STAKING;
};

// Calculate percent based on now to marker end of cycle
const calculatePercent = (now: Date, endDate: Date, months: number) => {
  const diff = differenceInSeconds(endDate, now);
  if (diff < 0) {
    console.error(
      'Data Error: Current date is less than entry date',
    );
  }
  const totalSecondsThisCycle = SECONDS_IN_MONTH * months;
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
