import { differenceInSeconds, addSeconds } from 'date-fns';
import { millify } from 'millify';
import { BigNumber } from 'ethers';
import { parseUnits, formatUnits } from 'ethers/lib/utils';

import { GraphVault, GraphVaultGroup } from 'hooks/core/types';
import { fromAtto } from 'utils/bigNumber';
import { Vault, VaultGroup, MarkerType, Marker } from './types';
import { VaultGroupBalances } from 'hooks/core/use-vault-group-token-balance';

import { Nullable } from 'types/util';

import env from 'constants/env';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Tokens, Token } from 'constants/env/types';

export const createDateFromSeconds = (dateInSeconds: string | number) => {
  const dateMs = Number(dateInSeconds) * 1000;
  return new Date(dateMs);
};

export const createVaultGroup = (subgraphVaultGroup: GraphVaultGroup): VaultGroup => {
  const vaults = subgraphVaultGroup.vaults.map((vault) => createVault(vault));
  const orderedVaults = vaults
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
    .map((vault, index) => {
      vault.label = String.fromCharCode(65 + index);
      return vault as Vault;
    });

  const { now, startDate, enterExitWindowDurationSeconds, periodDurationSeconds } = orderedVaults[0];

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

  const secondsSinceStart = differenceInSeconds(now, startDate);
  const cyclesSinceStart = Math.floor(secondsSinceStart / periodDurationSeconds);

  vaultGroup.cycleStart = addSeconds(startDate, cyclesSinceStart * periodDurationSeconds);
  vaultGroup.cycleEnd = addSeconds(vaultGroup.cycleStart, periodDurationSeconds);

  return vaultGroup as VaultGroup;
};

export const createVault = (subgraphVault: GraphVault): Partial<Vault> => {
  const startDate = createDateFromSeconds(subgraphVault.firstPeriodStartTimestamp);
  // const fakeTime = 41 * 60 * 60 * 24 * 1000;
  const fakeTime = 0;
  const now = new Date(Date.now() + fakeTime);
  const periodDurationSeconds = Number(subgraphVault.periodDuration);
  const windowDurationSeconds = Number(subgraphVault.enterExitWindowDuration);
  const numberOfPeriods = periodDurationSeconds / windowDurationSeconds;

  const enterExitWindowDurationSeconds = Number(subgraphVault.enterExitWindowDuration);
  const tvl = Number(subgraphVault.tvl);
  const currentCycle = getCurrentCycle(startDate, numberOfPeriods, now, windowDurationSeconds);
  const vaultIsInZone = calculateInZoneVaultInstance(
    now,
    startDate,
    currentCycle,
    periodDurationSeconds,
    enterExitWindowDurationSeconds
  );

  const user = subgraphVault.users[0];
  const userBalances = user?.vaultUserBalances || [];
  const vaultUserBalance = userBalances.find(({ id }) => id.startsWith(subgraphVault.id));

  const vault: Partial<Vault> = {
    id: subgraphVault.id,
    now,
    startDate,
    tvl,
    currentCycle,
    enterExitWindowDurationSeconds,
    periodDurationSeconds,
    startDateSeconds: Number(subgraphVault.firstPeriodStartTimestamp),
    isActive: vaultIsInZone,
    amountStaked: !!vaultUserBalance?.staked ? parseUnits(vaultUserBalance?.staked, 18) : BigNumber.from(0),
  };

  vault.unlockDate = calculateUnlockDate(vault as Vault);

  return vault;
};

export const getMarkers = (vaultGroup: Omit<VaultGroup, 'markers'>, balances: VaultGroupBalances): Marker[] => {
  const markers = [];
  for (const [i, vault] of vaultGroup.vaults.entries()) {
    const vaultBalance = balances[vault.id] || {};
    const marker = {
      vaultId: vault.id,
      staked: fromAtto(vaultBalance.staked || BigNumber.from(0)),
      percent: calculatePercent(vault),
      inZone: vault.isActive,
      type: MarkerType.HIDDEN,
      label: vault.label,
      unlockDate: calculateUnlockDate(vault),
      windowEndDate: calculateWindowEndDate(vault),
    };

    const amount = Number(vaultBalance.staked || 0);
    if (amount > 0) {
      marker.type = MarkerType.LOCKED;
      if (marker.inZone && vault.currentCycle > 0) {
        marker.type = MarkerType.WITHDRAWABLE;
      } else {
        marker.type = MarkerType.LOCKED;
      }
    } else if (marker.inZone) {
      marker.type = MarkerType.EMPTY;
    }

    markers.push(marker as Marker);
  }

  return markers;
};

const calculateUnlockDate = (vault: Vault) => {
  if (vault.isActive && vault.currentCycle > 0) {
    return 'NOW';
  }

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
// months_since_start = seconds_since_vault_start / seconds_in_window
// cycles_since_start = floor(months_since_start / vault_months)
const getCurrentCycle = (startDate: Date, months: number, now: Date, windowDuration: number) => {
  const monthsSinceStart = differenceInSeconds(now, startDate) / windowDuration;
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

export const formatTemple = (templeValue: Nullable<number | BigNumber>) => {
  if (!templeValue) {
    return '0';
  }

  const amount = typeof templeValue === 'number' ? templeValue : fromAtto(templeValue);

  return millify(amount, { precision: 4 });
};

export const getBigNumberFromString = (number: string, tokenDecimals?: number) => {
  // make sure number doesn't have more than 18 decimals
  let [int, decimals] = (number || '0').split('.');

  if (decimals && decimals.length > 18) {
    decimals = decimals.substring(0, 18);
  }
  const fixedNumber = decimals ? `${int}.${decimals}` : int;
  const bigNumber = parseUnits(fixedNumber, tokenDecimals ?? 18);

  return bigNumber;
};

export const formatBigNumber = (number: BigNumber, decimals?: number) => {
  return formatUnits(number, decimals ?? 18);
};

export const formatJoiningFee = (stakeAmount: BigNumber, joiningFee: BigNumber) => {
  return joiningFee.mul(stakeAmount).div('1000000000000000000');
};

export const getTokenInfo = (symbol: TICKER_SYMBOL): Token => {
  const tokenInFormat = symbol.toLowerCase().replace('$', '') as keyof Tokens;
  const tokenInfo = env.tokens[tokenInFormat];
  return tokenInfo;
};
