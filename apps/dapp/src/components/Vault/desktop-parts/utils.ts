import { differenceInSeconds, addSeconds, subSeconds, format } from 'date-fns';

import { GraphVault, GraphVaultGroup } from 'hooks/core/types';
import { Vault, VaultGroup, MarkerType, Marker } from '../types';

export const SECONDS_IN_MONTH = 60 * 60 * 24 * 30;

export const createVaultGroup = (subgraphVaultGroup: GraphVaultGroup): VaultGroup => {
  const vaults = subgraphVaultGroup.vaults.map((vault) => createVault(vault));
  const orderedVaults = vaults
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
    .map((vault, index) => {
      vault.label = String.fromCharCode(65 + index);
      return vault as Vault;
    });

  const {now, startDate, enterExitWindowDurationSeconds, periodDurationSeconds } = orderedVaults[0];

  const periods = periodDurationSeconds / enterExitWindowDurationSeconds;
  const tvl = vaults.reduce((total, { tvl }) => total + tvl!, 0);

  const vaultGroup: Partial<VaultGroup> = {
    ...subgraphVaultGroup,
    name: subgraphVaultGroup.id,
    vaults: orderedVaults,
    startDate,
    months: periods, // roughly.. only used for the label at end of timeline
    tvl,
    enterExitWindowDurationSeconds,
    periodDurationSeconds,
    periods,
  };

  vaultGroup.markers = getMarkers(vaultGroup as VaultGroup);
  
  const secondsSinceStart = differenceInSeconds(now, startDate);
  const cyclesSinceStart = Math.floor(secondsSinceStart / periodDurationSeconds);

  vaultGroup.cycleStart = addSeconds(startDate, cyclesSinceStart * periodDurationSeconds);
  vaultGroup.cycleEnd = addSeconds(vaultGroup.cycleStart, periodDurationSeconds);  

  return vaultGroup as VaultGroup;
};

export const createVault = (subgraphVault: GraphVault): Partial<Vault> => {
  const startDateSeconds = Number(subgraphVault.firstPeriodStartTimestamp);
  const startDate = new Date(startDateSeconds * 1000);
  // const fakeTime = 41 * 60 * 60 * 24 * 1000;
  const fakeTime = 0;
  const now = new Date(Date.now() + fakeTime);
  const periodDurationSeconds = Number(subgraphVault.periodDuration);
  const months = periodDurationSeconds / SECONDS_IN_MONTH;

  const enterExitWindowDurationSeconds = Number(subgraphVault.enterExitWindowDuration);
  const tvl = Number(subgraphVault.tvl);
  const currentCycle = getCurrentCycle(startDate, months, now);
  const vaultIsInZone = calculateInZoneVaultInstance(
    now,
    startDate,
    currentCycle,
    periodDurationSeconds,
    enterExitWindowDurationSeconds
  );

  const amountStaked = Number(subgraphVault.users[0]?.vaultUserBalances[0]?.staked || 0);

  const vault: Partial<Vault> = {
    id: subgraphVault.id,
    now,
    startDate,
    tvl,
    enterExitWindowDurationSeconds,
    periodDurationSeconds,
    isActive: vaultIsInZone,
    amountStaked,
  };
  
  return vault;
};

const getMarkers = (vaultGroup: Omit<VaultGroup, 'markers'>): Marker[] => {
  const markers = [];
  for (const [i, vault] of vaultGroup.vaults.entries()) {
    const marker: Partial<Marker> = {
      id: `marker-s${i}`,
      amount: vault.amountStaked,
      percent: calculatePercent(vault),
      inZone: vault.isActive,
      type: MarkerType.HIDDEN,
      label: vault.label,
    };

    marker.unlockDate = calculateUnlockDate(vault);
    marker.windowEndDate = calculateWindowEndDate(vault);
    if (marker.amount! > 0) {
      marker.type = MarkerType.STAKING;
      if (marker.inZone) {
        marker.type = MarkerType.STAKING_IN_ZONE;
      }
    } else if (marker.inZone) {
      marker.type = MarkerType.EMPTY;
    }

    markers.push(marker as Marker);
  }

  return markers;
};

const calculateUnlockDate = (vault: Vault) => {
  if (vault.isActive) return 'NOW';

  const diff = differenceInSeconds(vault.now, vault.startDate);
  const secondsIntoThisCycle = diff % vault.periodDurationSeconds;
  const secondsUntillEndOfSycle = vault.periodDurationSeconds - secondsIntoThisCycle;

  const endDate = addSeconds(vault.now, secondsUntillEndOfSycle);

  return endDate;
};

const calculateWindowEndDate = (vault: Vault) => {
  const secondsSinceStart = differenceInSeconds(vault.now, vault.startDate);
  const secondsIntoWindow = secondsSinceStart % vault.enterExitWindowDurationSeconds;
  const secondsUntilEndOfWindow = vault.enterExitWindowDurationSeconds - secondsIntoWindow;

  return addSeconds(vault.now, secondsUntilEndOfWindow);
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
  enterExitWindowDurationSeconds: number
) => {
  const nowSeconds = now.getTime() / 1000;
  const startSeconds = startDate.getTime() / 1000;

  if (currentCycle < 0) {
    // Vault hasn't begun yet.
    return false;
  }

  return currentCycle * periodDurationSeconds + startSeconds + enterExitWindowDurationSeconds > nowSeconds;
};

// Calculate percent based on now to marker end of cycle
const calculatePercent = (vault: Vault) => {
  const diff = differenceInSeconds(vault.now, vault.startDate);
  const secondsIntoThisCycle = diff % vault.periodDurationSeconds;
  const percent = secondsIntoThisCycle / vault.periodDurationSeconds;

  return percent;
};

// how many cycles since the vault started:
// months_since_start = seconds_since_vault_start / seconds_in_months
// cycles_since_start = floor(months_since_start / vault_months)
const getCurrentCycle = (startDate: Date, months: number, now: Date) => {
  const monthsSinceStart = differenceInSeconds(now, startDate) / SECONDS_IN_MONTH;
  const cyclesSinceStart = Math.floor(monthsSinceStart / months);

  return cyclesSinceStart;
};

// calculates the value that is at X% distance between A and B
// ex, half way between 2 and 8 is 5.. lerp(2,8,0.5)=5
// we use this to figure out the angle between the start and
// end of the timeline. Start being at -72 (or whatever) and end being at 72 (degrees)
// so if we know a marker is 15% into a cycle, then we know what degree to
// put it at.
export const lerp = (v0: number, v1: number, t: number) => v0 * (1 - t) + v1 * t;
