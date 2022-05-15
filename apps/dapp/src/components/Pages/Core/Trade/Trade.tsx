import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { VaultButton } from '../VaultPages/VaultContent';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { NAV_MOBILE_HEIGHT_PIXELS, NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import arrow from 'assets/icons/amm-arrow.svg';
import { pixelsToRems } from 'styles/mixins';
import { phoneAndAbove } from 'styles/breakpoints';

import { SwapMode } from './types';
import { useSwapController } from './use-swap-controller';

import { PageWrapper } from '../utils';
import { formatNumberWithCommas } from 'utils/formatter';

import Gear from 'assets/icons/gear.svg';

export const Trade = () => {
  const {
    state,
    handleSelectChange,
    handleInputChange,
    handleChangeMode,
    handleHintClick,
    handleTxSettingsUpdate,
    handleTransaction,
  } = useSwapController();

  const [isSlippageModalOpen, setIsSlippageModalOpen] = useState(false);

  const inputCryptoConfig =
    state.mode === SwapMode.Buy ? { ...state.inputConfig, onCryptoChange: handleSelectChange } : state.inputConfig;

  const outputCryptoConfig =
    state.mode === SwapMode.Sell ? { ...state.outputConfig, onCryptoChange: handleSelectChange } : state.outputConfig;

  const isButtonDisabled =
    state.isTransactionPending ||
    state.inputTokenBalance === 0 ||
    Number(state.inputValue) > state.inputTokenBalance ||
    state.inputValue === '';

  return (
    <PageWrapper>
      <h3>Trade</h3>
      <TransactionSettingsModal
        isOpen={isSlippageModalOpen}
        onClose={() => setIsSlippageModalOpen(false)}
        onChange={(settings) => handleTxSettingsUpdate(settings)}
      />

      <Container>
        <SwapContainer>
          <SettingsButton onClick={() => setIsSlippageModalOpen(true)} />
          <InputsContainer>
            <Input
              crypto={inputCryptoConfig}
              handleChange={handleInputChange}
              isNumber
              value={state.inputValue}
              placeholder="0"
              onHintClick={handleHintClick}
              min={0}
              hint={`Balance: ${formatNumberWithCommas(state.inputTokenBalance)}`}
            />
            <Spacer />
            <Input
              crypto={outputCryptoConfig}
              value={formatNumberWithCommas(state.quoteValue)}
              hint={`Balance: ${formatNumberWithCommas(state.outputTokenBalance)}`}
              disabled
            />
            <InvertButton onClick={handleChangeMode} />
          </InputsContainer>
          <Spacer />
          <SwapButton
            label={state.buttonLabel}
            onClick={state.isSlippageTooHigh ? () => setIsSlippageModalOpen(true) : handleTransaction}
            disabled={isButtonDisabled}
          />
        </SwapContainer>
      </Container>
    </PageWrapper>
  );
};

const Container = styled.section`
  margin-top: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  ${phoneAndAbove(`
    margin-top: ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem;
  `)}
`;

const SwapContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
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
  height: 2.5rem;
  width: 2.5rem;
  top: calc(50% - 1.35rem);
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

const Spacer = styled.div`
  height: ${pixelsToRems(10)}rem;
`;

const SettingsButton = styled.button`
  position: relative;
  left: calc(50% - 0.75rem);
  background-color: transparent;
  background: url(${Gear});
  background-repeat: no-repeat;
  background-size: fill;
  filter: brightness(0.75);
  border: none;

  height: 1.5rem;
  width: 1.5rem;

  margin-bottom: 0.75rem;

  transition: 500ms ease;

  :hover:not(:disabled) {
    background-color: transparent;
    filter: brightness(1);
    cursor: pointer;
  }
`;

const SwapButton = styled(VaultButton)`
  width: 70%;
  font-size: 1.2rem;
  letter-spacing: 0.25rem;
  transition: 500ms ease;
`;
