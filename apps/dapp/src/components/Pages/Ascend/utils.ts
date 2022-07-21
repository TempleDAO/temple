import { BigNumber } from 'ethers';
import { formatDuration, intervalToDuration } from 'date-fns';

import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { Pool } from 'components/Layouts/Ascend/types';

export const getRemainingTime = (pool?: Pool) => {
  const weights = pool?.weightUpdates || [];
  const lastUpdate = weights[weights.length - 1];
  const startTime = lastUpdate ? lastUpdate.startTimestamp : null;
  const now = Date.now();

  if (!startTime || now >= startTime.getTime()) {
    return '';
  }

  const duration = intervalToDuration({
    start: now,
    end: startTime,
  });

  return formatDuration(duration, {
    format: ['months', 'weeks', 'days', 'hours', 'seconds'],
  });
};

export const getSpotPrice = (
  balanceSell: BigNumber,
  balanceBuy: BigNumber,
  weightSell: BigNumber,
  weightBuy: BigNumber,
  swapFee: BigNumber,
): BigNumber => {
  const bs = parseFloat(formatBigNumber(balanceSell));
  const bb = parseFloat(formatBigNumber(balanceBuy));
  const ws = parseFloat(formatBigNumber(weightSell));
  const wb = parseFloat(formatBigNumber(weightBuy));

  const price = (bs / ws) / (bb / wb);
  const fee = (1 / (1 - parseFloat(formatBigNumber(swapFee))));
  const spot = getBigNumberFromString(`${price * fee}`);

  return spot;
};