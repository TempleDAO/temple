import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { VaultButton } from '../../VaultPages/VaultContent';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { NAV_MOBILE_HEIGHT_PIXELS, NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import arrow from 'assets/icons/amm-arrow.svg';
import { pixelsToRems } from 'styles/mixins';
import { phoneAndAbove } from 'styles/breakpoints';

import { SwapMode, SwapReducerState } from '../types';
import { useSwapController,  } from '../use-swap-controller';

import { PageWrapper } from '../../utils';
import { formatNumberWithCommas } from 'utils/formatter';
import {Unstake} from './Unstake';

import Gear from 'assets/icons/gear.svg';

import {
  Container,
  SwapContainer,
  InputsContainer,
  SettingsButton,
  Spacer,
  InvertButton,
  SwapButton
} from '../styles';

type Props = ReturnType<typeof useSwapController>;

export const Trade = ({
  state,
  handleChangeMode,
  handleSelectChange,
  handleInputChange,
  handleHintClick,
}: Props) => {
  const inputCryptoConfig =
    state.mode === SwapMode.Buy ? { ...state.inputConfig, onCryptoChange: handleSelectChange } : state.inputConfig;

  const outputCryptoConfig =
    state.mode === SwapMode.Sell ? { ...state.outputConfig, onCryptoChange: handleSelectChange } : state.outputConfig;

  return (
    <>
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
        <SwapButton label={state.buttonLabel} />
      </SwapContainer>
    </>
  );
};
