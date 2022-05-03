import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { CoreButton } from 'components/Button/CoreButton';

import arrow from 'assets/icons/amm-arrow.svg';

import { Container } from '../Trade';
import { SwapMode } from '../types';
import { useSwapController } from '../use-swap-controller';

export const Swap = () => {
  const { state, handleSelectChange, handleChangeMode } = useSwapController();

  // Making this an IIFE prevents the component constantly re-rendering and losing focus on state changes
  return (() => {
    const inputCryptoConfig =
      state.mode === SwapMode.BUY
        ? { ...state.inputConfig, onCryptoChange: handleSelectChange }
        : state.inputConfig;

    const outputCryptoConfig =
      state.mode === SwapMode.SELL
        ? { ...state.outputConfig, onCryptoChange: handleSelectChange }
        : state.outputConfig;

    return (
      <Container>
        <SwapContainer>
          <InputsContainer>
            <Input
              crypto={inputCryptoConfig}
              handleChange={handleSelectChange}
              value={state.inputToken}
              min={0}
              hint={`Balance: 0`}
              disabled={state.mode === SwapMode.BUY}
            />
            <Spacer />
            <Input
              crypto={outputCryptoConfig}
              handleChange={handleSelectChange}
              value={state.outputToken}
              hint={`Balance: 0`}
              disabled={state.mode === SwapMode.SELL}
            />
            <InvertButton
              onClick={handleChangeMode}
              isBuy={state.mode === SwapMode.BUY}
            />
          </InputsContainer>
          <Spacer />

          <CoreButton
            label={`Exchange ${state.inputToken} for ${state.outputToken}`}
          />
        </SwapContainer>
      </Container>
    );
  })();
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
  transition: 150ms ease;
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;

  :hover {
    transform: rotate(180deg);
  }
`;

const SwapButton = styled(CoreButton)`
  width: 70%;
`;

const Spacer = styled.div`
  height: 0.625rem /* 10/16 */;
`;
