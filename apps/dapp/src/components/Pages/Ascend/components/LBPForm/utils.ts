import { format, parse } from 'date-fns';
import { Pool } from 'components/Layouts/Ascend/types';

import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { formatUnits } from 'ethers/lib/utils';
import { Token } from 'constants/env/types'

import {
  FormToken,
  Values,
  InputType,
} from './types'

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
    };
  }

  const lastWeightUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];

  return {
    id: pool.id,
    fees: 1,
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
  return {
    name: token.name,
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    startWeight: DBN_ZERO,
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
    default:
      return value;
  }
}

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
