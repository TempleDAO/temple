import React from 'react';
import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import Slippage from 'components/Slippage/Slippage';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import arrow from 'assets/icons/amm-arrow.svg';
import { CoreButton } from 'components/Button/CoreButton';
import { Container } from '../Trade';
import { useSwapController } from '../use-swap-controller';

export const Swap = () => {
  const { state, handleSelectChange, handleChangeMode } = useSwapController();

  const inputCryptoConfig =
    state.mode === 'BUY'
      ? { ...state.inputConfig, onCryptoChange: handleSelectChange }
      : state.inputConfig;

  const outputCryptoConfig =
    state.mode === 'SELL'
      ? { ...state.outputConfig, onCryptoChange: handleSelectChange }
      : state.outputConfig;

  const Swap = () => {
    return (
      <Container>
        <SwapContainer>
          <InputsContainer>
            <Input
              crypto={inputCryptoConfig}
              value={0}
              min={0}
              hint={`Balance: 0`}
              disabled={state.mode === 'SELL'}
            />
            <Spacer />
            <Input
              crypto={outputCryptoConfig}
              value={0}
              hint={`Balance: 0`}
              disabled={state.mode === 'BUY'}
            />
            <InvertButton
              onClick={handleChangeMode}
              isBuy={state.mode === 'BUY'}
            />
          </InputsContainer>
          <Spacer />
          <Slippage
            label={`${TICKER_SYMBOL.TEMPLE_TOKEN}: ($0.65)`}
            value={1}
            onChange={() => console.log('slippage changed')}
          />
          <Spacer />

          <CoreButton
            label={`Exchange ${state.inputToken} for ${state.outputToken}`}
          />
        </SwapContainer>
      </Container>
    );
  };

  return <Swap />;
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

const InvertButton = styled(CoreButton)<{ isBuy?: boolean }>`
  position: absolute;
  height: 2.5rem /* 40/16 */;
  width: 2.5rem /* 40/16 */;
  top: calc(50% - 1.25rem);
  left: calc(50% - 1.25rem);
  border: none;
  cursor: pointer;
  background: url(${arrow});
  transform: ${(props) => props.isBuy && 'rotate(180deg)'} 
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;
`;

const Spacer = styled.div`
  height: 0.625rem /* 10/16 */;
`;
