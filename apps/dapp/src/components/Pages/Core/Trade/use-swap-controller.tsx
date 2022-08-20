import { useEffect, useReducer } from 'react';
import { BigNumber } from 'ethers';

import { Option } from 'components/InputSelect/InputSelect';
import { TransactionSettings } from 'components/TransactionSettingsModal/TransactionSettingsModal';

import { useWallet } from 'providers/WalletProvider';
import { useSwap } from 'providers/SwapProvider';

import { fromAtto, toAtto, ZERO } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';

import { INITIAL_STATE, TOKENS_BY_MODE } from './constants';
import { SwapMode } from './types';
import { isTokenFraxOrFei } from './utils';
import { swapReducer } from './reducer';

import env from 'constants/env';

export function useSwapController() {
  const { wallet } = useWallet();
  const [state, dispatch] = useReducer(swapReducer, INITIAL_STATE);
  const { balance, updateBalance } = useWallet();
  const { getBuyQuote, getSellQuote, templePrice, updateTemplePrice, buy, sell, iv, updateIv, error } = useSwap();

  useEffect(() => {
    const onMount = async () => {
      console.log('wallet connected');
      await updateBalance();
      await updateTemplePrice();
      await updateIv();

      if (templePrice > iv * env.fraxSellDisabledIvMultiple) {
        dispatch({
          type: 'enableFraxSell',
          fraxBalance: balance.frax,
        });
      }

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
    const bigValue = getBigNumberFromString(value || '0');
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
    const amount = state.inputTokenBalance.eq(ZERO) ? '' : formatBigNumber(state.inputTokenBalance);
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
    if (!isTokenFraxOrFei(state.inputToken)) {
      console.error('Invalid input token');
      return;
    } else {
      const tokenAmount = getBigNumberFromString(state.inputValue);

      const buyQuote = await getBuyQuote(tokenAmount, state.inputToken);

      if (!tokenAmount || !buyQuote) {
        console.error("Couldn't get buy quote");
        return;
      }

      const minAmountOut = (fromAtto(tokenAmount) / templePrice) * (1 - state.slippageTolerance / 100);

      if (minAmountOut > fromAtto(buyQuote)) {
        dispatch({
          type: 'slippageTooHigh',
        });
        return;
      }

      const txReceipt = await buy(tokenAmount, toAtto(minAmountOut), state.inputToken, state.deadlineMinutes);

      if (txReceipt) {
        await updateBalance();
        await updateTemplePrice();
        dispatch({
          type: 'txSuccess',
        });
      }
    }
  };

  const handleSell = async () => {
    if (!isTokenFraxOrFei(state.outputToken)) {
      console.error('Invalid output token');
    } else {
      const templeAmount = getBigNumberFromString(state.inputValue);
      const sellQuote = await getSellQuote(templeAmount);

      if (!templeAmount || !sellQuote) {
        console.error("Couldn't get sell quote");
        return;
      }

      const minAmountOut = fromAtto(templeAmount) * templePrice * (1 - state.slippageTolerance / 100);

      if (minAmountOut > fromAtto(sellQuote.amountOut)) {
        dispatch({
          type: 'slippageTooHigh',
        });
        return;
      }

      const txReceipt = await sell(
        templeAmount,
        toAtto(minAmountOut),
        state.outputToken,
        sellQuote.priceBelowIV,
        state.deadlineMinutes
      );

      if (txReceipt) {
        await updateBalance();
        await updateTemplePrice();
        dispatch({
          type: 'txSuccess',
        });
      }
    }
  };

  const getTokenBalance = (token: TICKER_SYMBOL): BigNumber => {
    switch (token) {
      case TICKER_SYMBOL.FRAX:
        return balance.frax;
      case TICKER_SYMBOL.FEI:
        return balance.fei;
      case TICKER_SYMBOL.TEMPLE_TOKEN:
        return balance.temple;
      default:
        return ZERO;
    }
  };

  const fetchQuote = async (value: BigNumber): Promise<BigNumber> => {
    let quote = value;

    if (state.mode === SwapMode.Buy && isTokenFraxOrFei(state.inputToken)) {
      const buyQuote = await getBuyQuote(value, state.inputToken);
      quote = buyQuote ?? ZERO;
    }

    // if (state.mode === SwapMode.Sell && isTokenFraxOrFei(state.outputToken)) {
    //   const sellQuote = await getSellQuote(value, state.outputToken);

    //   quote = sellQuote ? sellQuote.amountOut : ZERO;

    //   const isPriceNearIv = templePrice < iv * env.fraxSellDisabledIvMultiple;

    //   // if (sellQuote) {
    //   //   if (!state.isFraxSellDisabled && sellQuote.priceBelowIV) {
    //   //     dispatch({
    //   //       type: 'disableFraxSell',
    //   //       feiBalance: balance.fei,
    //   //     });
    //   //   }
    //   //   if (state.isFraxSellDisabled && !sellQuote.priceBelowIV && !isPriceNearIv) {
    //   //     dispatch({
    //   //       type: 'enableFraxSell',
    //   //       fraxBalance: balance.frax,
    //   //     });
    //   //   }
    //   // }
    // }

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
