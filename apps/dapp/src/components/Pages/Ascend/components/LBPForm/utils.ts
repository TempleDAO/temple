import { format, parse } from 'date-fns';
import { formatUnits } from 'ethers/lib/utils';

import { Pool } from 'components/Layouts/Ascend/types';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { Token } from 'constants/env/types';
import { formatBigNumber } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { JoinType } from '../Trade/hooks/use-vault-contract';
import env from 'constants/env';

import { FormToken, Values, InputType } from './types';
import { ZERO } from 'utils/bigNumber';

export const getInitialValues = (pool?: Pool): Values => {
  if (!pool) {
    return {
      name: '',
      symbol: '',
      fees: 1,
      tokens: {},
      startDate: new Date(),
      endDate: new Date(),
      joinPool: {},
      joinType: JoinType.Init,
    };
  }

  const lastWeightUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const swapFee = formatNumber(formatBigNumber(pool.swapFee));

  return {
    id: pool.id,
    // Fees are a decimal from 0 to 1 and we represent the number as a whole number from 0 to 100 in the UI.
    fees: swapFee * 100,
    tokens: pool.tokens.reduce((acc, token, i) => {
      return {
        ...acc,
        [token.address]: {
          ...token,
          index: i,
          balance: DBN_ZERO,
          startWeight: lastWeightUpdate.startWeights[i],
          endWeight: lastWeightUpdate.endWeights[i],
        },
      };
    }, {}),
    joinType: pool.totalLiquidity.eq(ZERO) ? JoinType.Init : JoinType.Add,
    joinPool: pool.tokens.reduce((acc, token, i) => {
      return {
        ...acc,
        [token.address]: '',
      };
    }, {}),
    name: pool.name,
    symbol: pool.symbol,
    startDate: lastWeightUpdate.startTimestamp,
    endDate: lastWeightUpdate.endTimestamp,
  };
};

export const createTokenDefaults = (token: Token, index: number): FormToken => {
  const startWeight = token.address === env.tokens.temple.address ? 4 : 96;
  return {
    name: token.name,
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    startWeight: DecimalBigNumber.parseUnits(startWeight.toString(), 16),
    endWeight: DBN_ZERO,
    balance: DBN_ZERO,
    index,
  };
};

export const formatValueByType = (value: any, type: InputType) => {
  switch (type) {
    case 'date': {
      try {
        return parse(value, "yyyy-LL-dd'T'kk:mm", new Date());
      } catch (error) {
        console.error(error);
        return new Date();
      }
    }
    case 'bn':
      return DecimalBigNumber.parseUnits(value || '0', 16);
    case 'number':
      return Number(value);
    default:
      return value;
  }
};

export const formatDate = (date: Date) => {
  if (!date) return;
  try {
    return format(date, "yyyy-LL-dd'T'kk:mm");
  } catch (error) {
    console.error(error);
    return format(new Date(), "yyyy-LL-dd'T'kk:mm");
  }
};

export const formatWeight = (weight: DecimalBigNumber) => {
  if (!weight) return '0';
  return Math.trunc(Number(formatUnits(weight.value, 16)));
};
