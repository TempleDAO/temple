import { useState } from 'react';

import { Input } from './HomeInput';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';

import { SwapMode } from '../../Core/Trade/types';
import { useSwapController } from '../../Core/Trade/use-swap-controller';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
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
} from '../../Core/Trade/styles';
import { ZERO } from 'utils/bigNumber';
import { INITIAL_STATE } from '../../Core/Trade/constants';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Button } from 'components/Button/Button';

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

  return (
    <>
      <TransactionSettingsModal
        isOpen={isSlippageModalOpen}
        defaultSlippage={INITIAL_STATE.slippageTolerance}
        onClose={() => setIsSlippageModalOpen(false)}
        onChange={(settings) => handleTxSettingsUpdate(settings)}
      />
      <HeaderText>Trade</HeaderText>
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
            hint={`Balance: ${formatNumber(formatBigNumber(state.inputTokenBalance))}`}
          />
          <Spacer />
          <Input
            crypto={outputCryptoConfig}
            value={formatNumber(formatBigNumber(state.quoteValue))}
            hint={`Balance: ${formatNumber(formatBigNumber(state.outputTokenBalance))}`}
            disabled
          />
          <InvertButton onClick={handleChangeMode} />
        </InputsContainer>
        {/* <Spacer /> */}
        <AdvancedSettingsButton onClick={() => setIsSlippageModalOpen(true)}>Advanced Settings</AdvancedSettingsButton>
        <TradeButton label={'Confirm'} onClick={handleTransaction} />
      </SwapContainer>
      {state.error && <ErrorLabel>{state.error.message}</ErrorLabel>}
    </>
  );
};

const TradeButton = styled(Button)`
  padding: 20px;
  gap: 20px;
  width: 120px;
  height: 52px;
  background: linear-gradient(180deg, #353535 45.25%, #101010 87.55%);
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 10px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffdec9;
`;

const AdvancedSettingsButton = styled.div`
  height: 18px;
  font-style: normal;
  font-weight: 700;
  font-size: 12px;
  line-height: 153.11%;
  text-align: center;
  letter-spacing: 0.095em;
  text-decoration-line: underline;
  color: #bd7b4f;
  margin: 10px;
`;

const HeaderText = styled.div`
  height: 32px;
  padding: 40px;
  font-size: 36px;
  line-height: 42px;
  display: flex;
  align-items: center;
  text-align: center;
  color: #ffdec9;
`;
