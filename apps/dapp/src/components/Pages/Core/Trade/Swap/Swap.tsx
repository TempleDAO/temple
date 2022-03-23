import React, { useReducer, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import useSwapController from './use-swap-controller';
import { Input } from 'components/Input/Input';
import { Button } from 'components/Button/Button';
import Slippage from 'components/Slippage/Slippage';
import { Tabs } from 'components/Tabs/Tabs';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { noop } from 'utils/helpers';
import arrow from 'assets/icons/amm-arrow.svg';

export const Swap = () => {
  const {
    state,
    templePrice,
    updateBalance,
    updateZapperBalances,
    handleInputChange,
    handleSelectChange,
    handleSlippageUpdate,
    handleTransaction,
    handleHintClick,
  } = useSwapController();

  useEffect(() => {
    async function onMount() {
      await updateBalance();
      await updateZapperBalances();
    }

    onMount();
  }, []);

  const isSwapButtonDisabled =
    state.slippageTooHigh ||
    state.inputTokenBalance === 0 ||
    state.inputValue > state.inputTokenBalance;

  const Swap = (
    <SwapContainer>
      <Input
        crypto={{ ...state.inputConfig, onCryptoChange: handleSelectChange }}
        handleChange={handleInputChange}
        value={state.inputValue}
        min={0}
        max={state.inputTokenBalance}
        hint={`Balance: ${state.inputTokenBalance}`}
        onHintClick={handleHintClick}
      />
      <Spacer />
      <Input crypto={state.outputConfig} disabled value={state.quoteValue} />
      <Slippage
        label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
        value={state.slippageValue}
        onChange={handleSlippageUpdate}
      />
      <InvertButton disabled={state.ongoingTx} />
      <Button
        label={
          state.slippageTooHigh
            ? `Increase slippage`
            : `Exchange ${state.inputToken} for ${state.outputToken}`
        }
        onClick={isSwapButtonDisabled ? handleTransaction : noop}
        isUppercase
        disabled={isSwapButtonDisabled}
      />
    </SwapContainer>
  );

  return (
    <Tabs
      tabs={[
        {
          label: 'Swap',
          content: Swap,
        },
        {
          label: 'Unlock',
          content: <SwapContainer>unlock $temple</SwapContainer>,
        },
      ]}
    />
  );
};

const SwapContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  min-width: 20rem /*320/16*/;
`;

const InvertButton = styled.button`
  position: absolute;
  height: 2.5rem /* 40/16 */;
  width: 2.5rem /* 40/16 */;
  top: calc(50% - 1.25rem);
  left: calc(50% - 1.25rem);
  border: none;
  cursor: pointer;
  background: url(${arrow});
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;
`;

const Spacer = styled.div`
  height: 0.625rem /* 10/16 */;
`;
