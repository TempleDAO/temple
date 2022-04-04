import React, { useState, useCallback, useEffect } from 'react';
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
    handleInputChange,
    handleSelectChange,
    handleSlippageUpdate,
    handleTransaction,
    handleHintClick,
    handleChangeMode,
  } = useSwapController();

  const [cachedRefreshNonce, setRefreshNonce] = useState(
    state.forceRefreshNonce
  );

  useEffect(() => {
    if (state.forceRefreshNonce !== cachedRefreshNonce) {
      setRefreshNonce(state.forceRefreshNonce);
    }
  }, [state.forceRefreshNonce]);

  // no easy way to externally change the selected option of the input so we force re-render the whole component on state change
  const ForceRefreshedInput = useCallback(() => {
    return (
      <>
        <Input
          crypto={{
            ...state.inputConfig,
            onCryptoChange: handleSelectChange,
          }}
          handleChange={handleInputChange}
          value={state.inputValue}
          min={0}
          max={state.inputTokenBalance}
          hint={`Balance: ${state.inputTokenBalance}`}
          onHintClick={handleHintClick}
        />
      </>
    );
  }, [state.forceRefreshNonce]);

  const isSwapButtonDisabled =
    state.slippageTooHigh ||
    state.inputTokenBalance === 0 ||
    Number(state.inputValue) > state.inputTokenBalance;

  const Swap = (
    <SwapContainer>
      <InputsContainer>
        {cachedRefreshNonce !== state.forceRefreshNonce ? (
          <ForceRefreshedInput />
        ) : (
          <Input
            crypto={{
              ...state.inputConfig,
              onCryptoChange: handleSelectChange,
            }}
            handleChange={handleInputChange}
            value={state.inputValue}
            min={0}
            max={state.inputTokenBalance}
            hint={`Balance: ${state.inputTokenBalance}`}
            onHintClick={handleHintClick}
          />
        )}
        <Spacer />
        <Input crypto={state.outputConfig} disabled value={state.quoteValue} />
        <InvertButton onClick={handleChangeMode} disabled={state.ongoingTx} />
      </InputsContainer>
      <Slippage
        label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: (${formatNumber(templePrice)})`}
        value={state.slippageValue}
        onChange={handleSlippageUpdate}
      />
      <Button
        label={
          state.slippageTooHigh
            ? `Increase slippage`
            : `Exchange ${state.inputToken} for ${state.outputToken}`
        }
        onClick={isSwapButtonDisabled ? noop : handleTransaction}
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
  padding: 0.3125rem /* 5/16 */;
`;

const InputsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
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
