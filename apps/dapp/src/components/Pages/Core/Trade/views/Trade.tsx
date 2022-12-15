import { useState } from 'react';

import { Input } from 'components/Input/Input';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';

import { SwapMode } from '../types';
import { useSwapController } from '../use-swap-controller';
import { getBigNumberFromString, formatBigNumber, getTokenInfo } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';

import {
  SwapContainer,
  InputsContainer,
  SettingsButton,
  Spacer,
  InvertButton,
  CtaButton,
  Header,
  ErrorLabel,
} from '../styles';
import { ZERO } from 'utils/bigNumber';
import { INITIAL_STATE } from '../constants';

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

  const bigInputValue = getBigNumberFromString(state.inputValue || '0');

  const isButtonDisabled =
    state.isTransactionPending ||
    state.inputTokenBalance.eq(ZERO) ||
    bigInputValue.gt(state.inputTokenBalance) ||
    state.inputValue === '';

  const inputHint = `Balance: ${formatNumber(
    formatBigNumber(state.inputTokenBalance, getTokenInfo(state.inputToken).decimals)
  )}`;
  const outputHint = `Balance: ${formatNumber(
    formatBigNumber(state.outputTokenBalance, getTokenInfo(state.outputToken).decimals)
  )}`;

  return (
    <>
      <TransactionSettingsModal
        isOpen={isSlippageModalOpen}
        defaultSlippage={INITIAL_STATE.slippageTolerance}
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
            hint={inputHint}
          />
          <Spacer />
          <Input
            crypto={outputCryptoConfig}
            value={formatNumber(formatBigNumber(state.quoteValue, getTokenInfo(state.outputToken).decimals))}
            hint={outputHint}
            disabled
          />
          <InvertButton onClick={handleChangeMode} />
        </InputsContainer>
        <Spacer />
        <CtaButton label={state.buttonLabel} onClick={handleTransaction} disabled={isButtonDisabled} />
      </SwapContainer>
      {state.error && <ErrorLabel>{state.error.message}</ErrorLabel>}
    </>
  );
};
