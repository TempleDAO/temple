import { useEffect, useReducer } from 'react';
import { BigNumber } from 'ethers';
import { Option } from 'components/InputSelect/InputSelect';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';
import { ZERO } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { getBigNumberFromString, formatBigNumber, getTokenInfo } from 'components/Vault/utils';
import { INITIAL_STATE, TOKENS_BY_MODE } from './constants';
import { SwapMode } from './types';
import { swapReducer } from './reducer';
import { useDebouncedCallback } from 'use-debounce';

export const useSwapController = () => {
  const { wallet } = useWallet();
  const [state, dispatch] = useReducer(swapReducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, buy, sell, error } = useSwap();

  // Fetch quote, debounced
  const debouncedFetchQuote = useDebouncedCallback(async (amount: BigNumber) => {
    const quote =
      state.mode === SwapMode.Buy
        ? await getBuyQuote(amount, state.inputToken)
        : await getSellQuote(amount, state.outputToken);
    dispatch({ type: 'changeQuoteValue', value: quote ?? ZERO });
  }, 1000);

  // Update token balances on mount
  useEffect(() => {
    const onMount = async () => {
      await updateBalance();

      dispatch({
        type: 'changeInputTokenBalance',
        value: getTokenBalance(state.inputToken),
      });
      dispatch({
        type: 'changeOutputTokenBalance',
        value: getTokenBalance(state.outputToken),
      });
    };
    onMount();
  }, [wallet]);

  // Update token balances on balance or mode change
  useEffect(() => {
    dispatch({
      type: 'changeInputTokenBalance',
      value: getTokenBalance(state.inputToken),
    });
    dispatch({
      type: 'changeOutputTokenBalance',
      value: getTokenBalance(state.outputToken),
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
    const bigValue = getBigNumberFromString(state.inputValue || '0', getTokenInfo(state.inputToken).decimals);
    if (bigValue.eq(ZERO)) dispatch({ type: 'changeQuoteValue', value: ZERO });
    else debouncedFetchQuote(bigValue);
  }, [state.inputValue, state.inputToken, state.outputToken]);

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = (event: Option) => {
    const token = Object.values(TOKENS_BY_MODE[state.mode]).find((token) => token === event.value);
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
    const bigValue = getBigNumberFromString(value || '0', getTokenInfo(state.inputToken).decimals);
    const isZero = bigValue.eq(ZERO);
    dispatch({ type: 'changeInputValue', value: isZero ? '' : value });
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
      : formatBigNumber(state.inputTokenBalance, getTokenInfo(state.inputToken).decimals);
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
    if (state.mode === SwapMode.Buy) await handleBuy();
    else if (state.mode === SwapMode.Sell) await handleSell();
    dispatch({ type: 'endTx' });
  };

  // Execute buy transaction
  const handleBuy = async () => {
    const tokenAmount = getBigNumberFromString(state.inputValue, getTokenInfo(state.inputToken).decimals);
    const buyQuote = await getBuyQuote(tokenAmount, state.inputToken);
    if (!tokenAmount || !buyQuote) {
      console.error("Couldn't get buy quote");
      return;
    }
    // Buy
    const txReceipt = await buy(tokenAmount, state.inputToken, state.slippageTolerance);
    if (txReceipt) {
      await updateBalance();
      dispatch({ type: 'txSuccess' });
    }
  };

  // Execute sell transaction
  const handleSell = async () => {
    const templeAmount = getBigNumberFromString(state.inputValue, getTokenInfo(state.inputToken).decimals);
    const sellQuote = await getSellQuote(templeAmount, state.outputToken);
    if (!templeAmount || !sellQuote) {
      console.error("Couldn't get sell quote");
      return;
    }

    const txReceipt = await sell(templeAmount, state.outputToken, state.slippageTolerance);
    if (txReceipt) {
      await updateBalance();
      dispatch({ type: 'txSuccess' });
    }
  };

  const getTokenBalance = (token: TICKER_SYMBOL): BigNumber => {
    switch (token) {
      case TICKER_SYMBOL.USDC:
        return balance.usdc;
      case TICKER_SYMBOL.USDT:
        return balance.usdt;
      case TICKER_SYMBOL.DAI:
        return balance.dai;
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      default:
        return ZERO;
    }
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
