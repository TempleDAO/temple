import { useEffect, useReducer } from 'react';
import { BigNumber } from 'ethers';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { ZERO } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import {
  getBigNumberFromString,
  formatBigNumber,
  getTokenInfo,
} from 'components/Vault/utils';
import { INITIAL_STATE } from './constants';
import { SwapMode } from './types';
import { swapReducer } from './reducer';
import { useDebouncedCallback } from 'use-debounce';

export const useSwapController = () => {
  const { wallet } = useWallet();
  const [state, dispatch] = useReducer(swapReducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, buy, sell, error } = useSwap();

  // Fetch quote, debounced
  const debouncedFetchQuote = useDebouncedCallback(
    async (amount: BigNumber) => {
      const quote =
        state.mode === SwapMode.Buy
          ? await getBuyQuote(amount, state.inputToken)
          : await getSellQuote(amount, state.outputToken);
      dispatch({ type: 'changeQuoteValue', value: quote ?? null });
    },
    1000
  );

  // Update token balances on mount
  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      dispatch({
        type: 'changeTokenBalances',
        value: {
          input: getTokenBalance(state.inputToken),
          output: getTokenBalance(state.outputToken),
        },
      });
    };
    onMount();
  }, [wallet]);

  // Update token balances on balance or mode change
  useEffect(() => {
    dispatch({
      type: 'changeTokenBalances',
      value: {
        input: getTokenBalance(state.inputToken),
        output: getTokenBalance(state.outputToken),
      },
    });
  }, [state.mode, balance]);

  // Set error message on error
  useEffect(() => {
    const setErrorMessage = () => {
      if (wallet) {
        dispatch({
          type: 'setError',
          value: error,
        });
      }
    };
    setErrorMessage();
  }, [error]);

  // Update quote on input value change or input/output token change
  useEffect(() => {
    console.debug('initiate quote update');
    const bigValue = getBigNumberFromString(
      state.inputValue || '0',
      getTokenInfo(state.inputToken).decimals
    );
    if (bigValue.eq(ZERO)) {
      console.debug('input value is zero, setting quote to null');
      dispatch({ type: 'changeQuoteValue', value: null });
    } else {
      console.debug('input value is not zero, fetching quote');
      debouncedFetchQuote(bigValue);
    }
  }, [state.inputValue, state.inputToken, state.outputToken]);

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = (token: TICKER_SYMBOL) => {
    if (!token) throw new Error('Invalid token selected');
    if (state.mode === SwapMode.Sell) {
      dispatch({
        type: 'changeOutputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    } else if (state.mode === SwapMode.Buy) {
      dispatch({
        type: 'changeInputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }
  };

  // Handles user input change
  const handleInputChange = async (value: string) => {
    console.debug('handleInputChange', value);
    dispatch({ type: 'changeInputValue', value });
  };

  // Switch buy/sell mode
  const handleChangeMode = () => {
    dispatch({
      type: 'changeMode',
      value: state.mode === SwapMode.Buy ? SwapMode.Sell : SwapMode.Buy,
    });
  };

  // Set input value to max balance
  const handleHintClick = () => {
    const amount = state.inputTokenBalance.eq(ZERO)
      ? ''
      : formatBigNumber(
          state.inputTokenBalance,
          getTokenInfo(state.inputToken).decimals
        );
    handleInputChange(amount);
  };

  // Update slippage/deadline settings
  const handleTxSettingsUpdate = (settings: TransactionSettings) => {
    dispatch({
      type: 'changeTxSettings',
      value: settings,
    });
  };

  // Handle buy/sell transaction
  const handleTransaction = async () => {
    dispatch({ type: 'startTx' });
    const success =
      state.mode === SwapMode.Buy ? await handleBuy() : await handleSell();
    dispatch({ type: 'endTx' });
    return success;
  };

  // Execute buy transaction
  const handleBuy = async () => {
    const tokenAmount = getBigNumberFromString(
      state.inputValue,
      getTokenInfo(state.inputToken).decimals
    );
    // Get latest quote
    const buyQuote = await getBuyQuote(tokenAmount, state.inputToken);
    if (!tokenAmount || !buyQuote) {
      console.error("Couldn't get buy quote");
      return false;
    }
    // Don't execute if old quote was better than new quote
    if (state.quote?.returnAmount.lt(buyQuote.returnAmount)) {
      // TODO: Display warning to user that the price has changed
      console.log('Buy quote updated');
      dispatch({ type: 'changeQuoteValue', value: buyQuote });
      return false;
    }
    // Buy
    const txReceipt = await buy(
      buyQuote,
      state.inputToken,
      state.deadlineMinutes,
      state.slippageTolerance
    );
    if (txReceipt) {
      await updateBalance();
      dispatch({ type: 'txSuccess' });
      return true;
    }
    return false;
  };

  // Execute sell transaction
  const handleSell = async () => {
    const templeAmount = getBigNumberFromString(
      state.inputValue,
      getTokenInfo(state.inputToken).decimals
    );
    // Get latest quote
    const sellQuote = await getSellQuote(templeAmount, state.outputToken);
    if (!templeAmount || !sellQuote) {
      console.error("Couldn't get sell quote");
      return false;
    }
    // Don't execute if old quote was better than new quote
    if (state.quote?.returnAmount.gt(sellQuote.returnAmount)) {
      // TODO: Display warning to user that the price has changed
      console.log('Sell quote updated');
      dispatch({ type: 'changeQuoteValue', value: sellQuote });
      return false;
    }
    // Sell
    const txReceipt = await sell(
      sellQuote,
      state.outputToken,
      state.deadlineMinutes,
      state.slippageTolerance
    );
    if (txReceipt) {
      await updateBalance();
      dispatch({ type: 'txSuccess' });
      return true;
    }
    return false;
  };

  const getTokenBalance = (token: TICKER_SYMBOL): BigNumber => {
    return balance[token] || ZERO;
  };

  return {
    state,
    handleSelectChange,
    handleInputChange,
    handleChangeMode,
    handleHintClick,
    handleTxSettingsUpdate,
    handleTransaction,
  };
};
