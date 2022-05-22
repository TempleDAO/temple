import { useState } from 'react';

import { Input } from 'components/Input/Input';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';

import { SwapMode } from '../types';
import { useSwapController } from '../use-swap-controller';

import { formatNumberWithCommas } from 'utils/formatter';

import {
  SwapContainer,
  InputsContainer,
  SettingsButton,
  Spacer,
  InvertButton,
  CtaButton,
  Header,
} from '../styles';

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
    !state.isSlippageTooHigh &&
    (state.isTransactionPending ||
      state.inputTokenBalance === 0 ||
      Number(state.inputValue) > state.inputTokenBalance ||
      state.inputValue === '');

  return (
    <>
      <TransactionSettingsModal
        isOpen={isSlippageModalOpen}
        onClose={() => setIsSlippageModalOpen(false)}
        onChange={(settings) => handleTxSettingsUpdate(settings)}
      />
      <Header>
        <span>Trade</span>
        <SettingsButton type="button" onClick={() => setIsSlippageModalOpen(true)} />
      </Header>
      <SwapContainer>
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
        <CtaButton
          label={state.buttonLabel}
          onClick={state.isSlippageTooHigh ? () => setIsSlippageModalOpen(true) : handleTransaction}
          disabled={isButtonDisabled}
        />
      </SwapContainer>
    </>
  );
};
