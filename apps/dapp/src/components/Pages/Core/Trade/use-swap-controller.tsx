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
import { calculateMinAmountOut, isTokenFraxOrFei } from './utils';
import { swapReducer } from './reducer';

export function useSwapController() {
  const { wallet } = useWallet();
  const [state, dispatch] = useReducer(swapReducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, updateTemplePrice, buy, sell, updateIv, error } = useSwap();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await updateTemplePrice();
      await updateIv();

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

  // Handles selection of a new value in the select dropdown
  const handleSelectChange = (event: Option) => {
    const token = Object.values(TOKENS_BY_MODE[state.mode]).find((token) => token === event.value);

    if (!token) {
      throw new Error('Invalid token selected');
    }

    if (state.mode === SwapMode.Sell) {
      dispatch({
        type: 'changeOutputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }

    if (state.mode === SwapMode.Buy) {
      dispatch({
        type: 'changeInputToken',
        value: { token, balance: getTokenBalance(token) },
      });
    }

    if (isTokenFraxOrFei(token)) {
      updateTemplePrice(token);
    }
  };

  // Handles user input
  const handleInputChange = async (value: string) => {
    const bigValue = getBigNumberFromString(value || '0', getTokenInfo(state.inputToken).decimals);
    const isZero = bigValue.eq(ZERO);
    dispatch({ type: 'changeInputValue', value: isZero ? '' : value });

    if (isZero) {
      dispatch({ type: 'changeQuoteValue', value: ZERO });
    } else {
      const quote = await fetchQuote(bigValue);
      dispatch({ type: 'changeQuoteValue', value: quote });
    }
  };

  const handleChangeMode = () => {
    if (state.inputToken !== TICKER_SYMBOL.FRAX && state.outputToken !== TICKER_SYMBOL.FRAX) {
      updateTemplePrice(TICKER_SYMBOL.FRAX);
    }

    dispatch({
      type: 'changeMode',
      value: state.mode === SwapMode.Buy ? SwapMode.Sell : SwapMode.Buy,
    });
  };

  const handleHintClick = () => {
    const amount = state.inputTokenBalance.eq(ZERO)
      ? ''
      : formatBigNumber(state.inputTokenBalance, getTokenInfo(state.inputToken).decimals);
    handleInputChange(amount);
  };

  const handleTxSettingsUpdate = (settings: TransactionSettings) => {
    dispatch({
      type: 'changeTxSettings',
      value: settings,
    });
  };

  const handleTransaction = async () => {
    dispatch({
      type: 'startTx',
    });

    if (state.mode === SwapMode.Buy) {
      await handleBuy();
    }

    if (state.mode === SwapMode.Sell) {
      await handleSell();
    }

    dispatch({
      type: 'endTx',
    });
  };

  const handleBuy = async () => {
    const tokenAmount = getBigNumberFromString(state.inputValue, getTokenInfo(state.inputToken).decimals);
    const buyQuote = await getBuyQuote(tokenAmount, state.inputToken);

    if (!tokenAmount || !buyQuote) {
      console.error("Couldn't get buy quote");
      return;
    }

    const minAmountOut = calculateMinAmountOut(buyQuote.amountOut, state.slippageTolerance);

    const txReceipt = await buy(
      tokenAmount,
      minAmountOut,
      state.inputToken,
      state.deadlineMinutes,
      state.slippageTolerance,
      buyQuote.useApi
    );

    if (txReceipt) {
      await updateBalance();
      await updateTemplePrice();
      dispatch({
        type: 'txSuccess',
      });
    }
  };

  const handleSell = async () => {
    const templeAmount = getBigNumberFromString(state.inputValue, getTokenInfo(state.inputToken).decimals);
    const sellQuote = await getSellQuote(templeAmount, state.outputToken);

    if (!templeAmount || !sellQuote) {
      console.error("Couldn't get sell quote");
      return;
    }

    const minAmountOut = calculateMinAmountOut(sellQuote.amountOut, state.slippageTolerance);

    const txReceipt = await sell(
      templeAmount,
      minAmountOut,
      state.outputToken,
      sellQuote.priceBelowIV,
      state.deadlineMinutes,
      state.slippageTolerance,
      sellQuote.useApi
    );

    if (txReceipt) {
      await updateBalance();
      await updateTemplePrice();
      dispatch({
        type: 'txSuccess',
      });
    }
  };

  const getTokenBalance = (token: TICKER_SYMBOL): BigNumber => {
    switch (token) {
      case TICKER_SYMBOL.FRAX:
        return balance.frax;
      case TICKER_SYMBOL.FEI:
        return balance.fei;
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

  const fetchQuote = async (value: BigNumber): Promise<BigNumber> => {
    let quote = value;

    if (state.mode === SwapMode.Buy) {
      const buyQuote = await getBuyQuote(value, state.inputToken);
      quote = buyQuote?.amountOut ?? ZERO;
    } else if (state.mode === SwapMode.Sell) {
      const sellQuote = await getSellQuote(value, state.outputToken);
      quote = sellQuote ? sellQuote.amountOut : ZERO;
    }

    if (!quote) {
      console.error("couldn't fetch quote");
      return ZERO;
    }

    return quote;
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
}
