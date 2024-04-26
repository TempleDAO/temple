import { Popover } from 'components/Popover';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import React, { InputHTMLAttributes, KeyboardEvent, useState } from 'react';
import styled, { css } from 'styled-components';
import { theme } from 'styles/theme';
import { formatToken } from 'utils/formatter';
import ethImg from 'assets/images/newui-images/tokens/eth.png';
import wethImg from 'assets/images/newui-images/tokens/weth.png';
import daiImg from 'assets/images/newui-images/tokens/dai.png';
import fraxImg from 'assets/images/newui-images/tokens/frax.png';
import usdcImg from 'assets/images/newui-images/tokens/usdc.png';
import usdtImg from 'assets/images/newui-images/tokens/usdt.png';
import templeImg from 'assets/images/newui-images/tokens/temple.png';
import ohmImg from 'assets/images/newui-images/tokens/ohm.png';

interface SizeProps {
  small?: boolean;
  width?: number | string | undefined;
}

export interface CryptoSelector {
  kind: 'select';
  // A selector for the crypto, must provide onCryptoChange
  cryptoOptions: TICKER_SYMBOL[];
  // use to limit the number of elements shown in the selector at anytime
  maxSelectorItems?: number;
  selected: TICKER_SYMBOL;

  // Callback for cryptoSelector value change
  onCryptoChange?(option: TICKER_SYMBOL): void;
}

export interface CryptoValue {
  kind: 'value';
  value: string;
}

export interface InputProps
  extends SizeProps,
    InputHTMLAttributes<HTMLInputElement> {
  // extra information for the input
  hint?: string;
  // options for the crypto in the input
  crypto?: CryptoSelector | CryptoValue;
  // set our own type=number since we need type to be string
  // for proper display and input masking
  isNumber?: boolean;

  // Callback for input value change
  handleChange?(value: number | string): void;

  onHintClick?(): void;
  suffix?: string;
}

const TickerImages: Record<TICKER_SYMBOL, string> = {
  ETH: ethImg,
  WETH: wethImg,
  DAI: daiImg,
  FRAX: fraxImg,
  USDC: usdcImg,
  USDT: usdtImg,
  TEMPLE: templeImg,
  OGTEMPLE: templeImg,
  OHM: ohmImg,
};

/**
 * Primary UI component for user interaction
 */
export const Input = ({
  handleChange,
  onHintClick,
  hint,
  crypto,
  isNumber,
  type,
  value,
  disabled,
  ...props
}: InputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { balance } = useWallet();

  const renderCrypto = () => {
    if (!crypto) return null;
    if (crypto.kind === 'value') return <Ticker>{crypto.value}</Ticker>;
    if (crypto.kind === 'select') {
      return (
        <>
          <OptionContainer onClick={() => setIsOpen(true)}>
            <Ticker>{crypto.selected}</Ticker>
            <ChevronDownImg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </ChevronDownImg>
          </OptionContainer>
          <Popover
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            closeOnClickOutside={true}
            showCloseButton={false}
          >
            <SwapOptions>
              {crypto.cryptoOptions.map((option) => (
                <TokenOption
                  key={option}
                  onClick={() => {
                    crypto.onCryptoChange?.(option);
                    setIsOpen(false);
                  }}
                >
                  <TokenOptionName>
                    <img src={TickerImages[option]} width="32px" /> {option}
                  </TokenOptionName>
                  <span>{formatToken(balance[option], option)}</span>
                </TokenOption>
              ))}
            </SwapOptions>
          </Popover>
        </>
      );
    }
    return null;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!handleChange) return;
    const val = event.target.value;
    if (isNumber) {
      // if starting with a period, prepend 0
      if (val.charAt(0) === '.') {
        handleChange('0' + val);
        return;
      }
      // don't allow multiple periods
      if (val.indexOf('.') != val.lastIndexOf('.')) {
        event.preventDefault();
        return;
      }
    }
    handleChange(val);
  };

  // using onKeyPress instead of onChange,
  // otherwise cursor jumps around when editing in the middle
  const numbersOnly = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!/\.|\d/.test(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <InputWrapper isDisabled={disabled} width={props.width}>
      <InputTokenWrapper>
        {renderCrypto()}
        {hint && (
          <InputHint
            hasAction={!!onHintClick}
            onClick={() => {
              if (onHintClick) onHintClick();
            }}
          >
            {hint}
          </InputHint>
        )}
      </InputTokenWrapper>
      <InputStyled
        onChange={handleInputChange}
        onKeyPress={isNumber ? numbersOnly : undefined}
        type={type}
        value={value}
        disabled={disabled}
        {...props}
      />
    </InputWrapper>
  );
};

interface InputWrapperProps extends SizeProps {
  isDisabled?: boolean;
}

export const InputWrapper = styled.div<InputWrapperProps>`
  display: flex;
  position: relative;
  margin-bottom: 0.2rem;
  background-color: ${(props) => props.theme.palette.dark};
  height: ${({ small }) => (small ? '3rem' : '4.5rem')};

  border: 0.0625rem /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  width: ${({ width }) => width || '90%'};
  border-radius: 10px;
  padding: 0.75rem;

  ${(props) =>
    props.isDisabled &&
    css`
      background-color: ${(props) => props.theme.palette.brand25};
    `}
`;

const InputTokenWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  p {
    font-size: 1.25rem;
    margin-top: 0.55rem;
  }
`;

interface InputHintProps {
  hasAction: boolean;
}

export const InputHint = styled.small<InputHintProps>`
  color: ${theme.palette.brand};
  font-size: 0.65rem;
  text-align: center;
  text-transform: uppercase;
  width: max-content;

  ${(props) =>
    props.hasAction &&
    css`
      border-radius: 0.25em;
      cursor: pointer;
    `}
`;

export const InputStyled = styled.input`
  ${theme.typography.fonts.fontHeading};
  color: ${theme.palette.brand};
  background-color: transparent;
  font-size: 1.5rem;
  border: none;
  outline: none;
  width: 100%;
  text-align: right;
  padding-left: 0.5rem;

  // remove input number controls ^ v
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  appearance: textfield;
`;

const Ticker = styled.p`
  text-wrap: nowrap;
  margin: 0;
  color: ${theme.palette.brandLight};
  font-weight: bold;
`;

const OptionContainer = styled.div`
  display: flex;
  align-items: center;
  align-content: center;
  cursor: pointer;
  border: 0.0625rem solid ${(props) => props.theme.palette.brand};
  border-radius: 0.2rem;
  width: 100%;
  justify-content: space-between;
  padding: 0 0.5rem 0.5rem 0.5rem;
`;

const ChevronDownImg = styled.div`
  margin-left: 0.5rem;
  margin-top: 0.6rem;
  width: 1rem;
  color: ${theme.palette.brandLight};
`;

const SwapOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TokenOption = styled.div`
  padding: 0.75rem;
  font-size: 1.25rem;
  cursor: pointer;
  min-width: 20rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  :hover {
    background-color: ${theme.palette.brand25};
    border-radius: 0.5rem;
  }
`;

const TokenOptionName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
`;
