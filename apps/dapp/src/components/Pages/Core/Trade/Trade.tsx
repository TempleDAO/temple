import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { CoreButton } from 'components/Button/CoreButton';
import { NAV_MOBILE_HEIGHT_PIXELS, NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import arrow from 'assets/icons/amm-arrow.svg';
import { pixelsToRems } from 'styles/mixins';
import { phoneAndAbove } from 'styles/breakpoints';

import { SwapMode } from './types';
import { useSwapController } from './use-swap-controller';

import { PageWrapper } from '../utils';
import { formatNumberWithCommas } from 'utils/formatter';

export const Trade = () => {
  const { state, handleSelectChange, handleInputChange, handleChangeMode, handleHintClick } = useSwapController();

  const inputCryptoConfig =
    state.mode === SwapMode.Buy ? { ...state.inputConfig, onCryptoChange: handleSelectChange } : state.inputConfig;

  const outputCryptoConfig =
    state.mode === SwapMode.Sell ? { ...state.outputConfig, onCryptoChange: handleSelectChange } : state.outputConfig;

  return (
    <PageWrapper>
      <h3>Trade</h3>
      <Container>
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
              hasDivider
            />
            <Spacer />
            <Input
              crypto={outputCryptoConfig}
              value={formatNumberWithCommas(state.quoteValue)}
              hint={`Balance: ${formatNumberWithCommas(state.outputTokenBalance)}`}
              disabled
              hasDivider
            />
            <InvertButton onClick={handleChangeMode} />
          </InputsContainer>
          <Spacer />
          <SwapButton label={state.buttonLabel} />
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
  padding: 0.3125rem /* 5/16 */;
`;

const InputsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

const InvertButton = styled(CoreButton)`
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

const Spacer = styled.div`
  height: 0.625rem /* 10/16 */;
`;

const SwapButton = styled(CoreButton)`
  font-size: 1.2rem;
  ${phoneAndAbove(`
    font-size: 1.5rem;
  `)}
`;
