import { BigNumber } from 'ethers';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { SwapInfo } from '@balancer-labs/sdk';
import { CryptoSelector, CryptoValue } from '../NewUI/HomeInput';

export enum SwapMode {
  Buy = 'BUY',
  Sell = 'SELL',
}

type SwapInputConfig = CryptoSelector | CryptoValue;

export type SwapReducerAction =
  | { type: 'changeMode'; value: SwapMode }
  | {
      type: 'changeInputToken';
      value: { token: TICKER_SYMBOL; balance: BigNumber };
    }
  | {
      type: 'changeOutputToken';
      value: { token: TICKER_SYMBOL; balance: BigNumber };
    }
  | { type: 'changeInputValue'; value: string }
  | { type: 'changeQuoteValue'; value: SwapInfo | null }
  | { type: 'changeTxSettings'; value: TransactionSettings }
  | {
      type: 'changeTokenBalances';
      value: { input: BigNumber; output: BigNumber };
    }
  | { type: 'startTx' }
  | { type: 'endTx' }
  | { type: 'txSuccess' }
  | { type: 'slippageTooHigh' }
  | { type: 'setError'; value: Error | null };

export interface SwapReducerState {
  /*forceRefreshNonce: number;*/
  mode: SwapMode;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputValue: string;
  quote: SwapInfo | null;
  inputTokenBalance: BigNumber;
  outputTokenBalance: BigNumber;
  slippageTolerance: number;
  deadlineMinutes: number;
  inputConfig: SwapInputConfig;
  outputConfig: SwapInputConfig;
  isTransactionPending: boolean;
  error: Error | null;
}
