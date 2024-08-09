import { BigNumber } from 'ethers';
import { formatDuration, intervalToDuration } from 'date-fns';

import {
  formatBigNumber,
  getBigNumberFromString,
} from 'components/Vault/utils';
import { Pool } from 'components/Layouts/Ascend/types';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { ZERO } from 'utils/bigNumber';

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
  balanceSell: DecimalBigNumber,
  balanceBuy: DecimalBigNumber,
  weightSell: DecimalBigNumber,
  weightBuy: DecimalBigNumber,
  swapFee: BigNumber
): BigNumber => {
  const bs = parseFloat(balanceSell.formatUnits());
  const bb = parseFloat(balanceBuy.formatUnits());
  const ws = parseFloat(weightSell.formatUnits());
  const wb = parseFloat(weightBuy.formatUnits());

  // Pool doesn't have liquidity
  if (bs === 0 || bb === 0) {
    return ZERO;
  }

  const price = bs / ws / (bb / wb);

  const fee = 1 / (1 - parseFloat(formatBigNumber(swapFee)));
  const spot = getBigNumberFromString(`${price * fee}`);

  return spot;
};
