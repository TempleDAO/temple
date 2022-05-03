import { differenceInSeconds, addSeconds } from 'date-fns';

import { GraphVault, GraphVaultGroup } from 'hooks/core/types';
import { Entry, Vault, VaultGroup, MarkerType } from '../types';

export const SECONDS_IN_MONTH = 60 * 60 * 24 * 30;

export const createVaultGroup = (subgraphVaultGroup: GraphVaultGroup): VaultGroup => {
  const vaults = subgraphVaultGroup.vaults.map((vault) => createVault(vault));
  const orderedVaults = vaults.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const { startDate, months } = orderedVaults[0];

  // Sum all sub vaults tvl.
  const tvl = vaults.reduce((total, { tvl }) => total + tvl, 0);

  return {
    ...subgraphVaultGroup,
    name: subgraphVaultGroup.id,
    vaults: orderedVaults,
    startDate,
    months,
    tvl,
  };
};

export const createVault = (subgraphVault: GraphVault): Vault => {
  const startDateSeconds = Number(subgraphVault.firstPeriodStartTimestamp);
  // Vault startdate
  const startDate = new Date(startDateSeconds * 1000);

  // The current timestamp
  const now = new Date(Date.now());

  // Duration of vault
  const periodDurationSeconds = Number(subgraphVault.periodDuration);

  // periodDuration is the number of months.
  const months = periodDurationSeconds / SECONDS_IN_MONTH;

  // Vault fields
  const enterExitWindowDurationSeconds = Number(subgraphVault.enterExitWindowDuration);
  const tvl = Number(subgraphVault.tvl);
  const currentCycle = getCurrentCycle(startDate, months, now);
  const vaultIsInZone = calculateInZoneVaultInstance(
    now, startDate, currentCycle, periodDurationSeconds, enterExitWindowDurationSeconds)
  
  const entries = (subgraphVault.users?.[0]?.vaultUserBalances || []).map((balance) => {
    // Convert to milliseconds
    const entryDate = new Date((Number(balance.timestamp) * 1000));
    const percent = calculatePercent(months, currentCycle, now, startDate);
    const type = calculateEntryType(vaultIsInZone);

    return {
      id: balance.id,
      entryDate,
      percent,
      inZone: vaultIsInZone,
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
    enterExitWindowDurationSeconds,
    periodDurationSeconds,
    inZone: vaultIsInZone,
  };

  
  maybeInsertEmptyMarker(vault);
  
  return vault;
};

// If there is no other marker currently in the zone
// (because it cycled), then we should show the empty "Enter" marker
const maybeInsertEmptyMarker = (vault: Vault) => {
  const zoneEmpty = !vault.entries.length;
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


// Calculate if the vault is in an enter/exit window.
// Note: the following is the logic found inside the vault contract for determining if in enterExit window.
// uint256 numCylces = (block.timestamp - firstPeriodStartTimestamp) / periodDuration;
// return numCylces * periodDuration + firstPeriodStartTimestamp + enterExitWindowDuration > block.timestamp;
const calculateInZoneVaultInstance = (
  now: Date,
  startDate: Date,
  currentCycle: number,
  periodDurationSeconds: number,
  enterExitWindowDurationSeconds: number,
) => {
  const nowSeconds = now.getTime() / 1000;
  const startSeconds = startDate.getTime() / 1000;

  if (currentCycle < 0) {
    // Vault hasn't begun yet.
    return false;
  }

  return currentCycle * periodDurationSeconds + startSeconds + enterExitWindowDurationSeconds > nowSeconds;
};

// we treat the zone the same as a "percent", so the calculations for it are the same
// and we use the percent value as a comparison to determine if we're in or out of the zone
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
const calculatePercent = (months: number, currentCycle: number, now: Date, startDate: Date) => {
  const entryStartDate = startDate;
  const diff = differenceInSeconds(now, entryStartDate);
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
const getCurrentCycle = (startDate: Date, months: number, now: Date) => {
  const monthsSinceStart =
    differenceInSeconds(now, startDate) / SECONDS_IN_MONTH;
  const cyclesSinceStart = Math.floor(monthsSinceStart / months);

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
