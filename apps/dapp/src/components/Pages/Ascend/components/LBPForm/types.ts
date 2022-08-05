import { Pool } from 'components/Layouts/Ascend/types';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { JoinType } from '../Trade/hooks/use-vault-contract';

export interface FormToken {
  name: string;
  address: string;
  symbol?: string;
  decimals: number;
  startWeight: DecimalBigNumber;
  endWeight: DecimalBigNumber;
  balance: DecimalBigNumber;
  index: number;
}

export interface Values {
  id?: string;
  name: string;
  symbol: string;
  fees: number;
  tokens: {
    [address: string]: FormToken;
  };
  joinPool: {
    [address: string]: string;
  };
  joinType: JoinType;
  startDate: Date;
  endDate: Date;
}

export interface Props {
  pool?: Pool;
}

export type InputType = 'date' | 'number' | 'bn' | 'string';
