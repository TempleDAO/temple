import React, { InputHTMLAttributes, KeyboardEvent } from 'react';
import styled, { css } from 'styled-components';
import { tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import {
  InputSelect,
  Option,
  SelectTempleDaoOptions,
} from '../InputSelect/InputSelect';

interface SizeProps {
  small?: boolean;
}

export interface CryptoSelector {
  kind: 'select';
  // A selector for the crypto, must provide onCryptoChange
  cryptoOptions: SelectTempleDaoOptions;
  inputValue?: string;
  defaultValue?: Option;
  // use to limit the number of elements shown in the selector at anytime
  maxSelectorItems?: number;

  // Callback for cryptoSelector value change
  onCryptoChange?(event: any): void;
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
  handleChange?(value: number): void;

  onHintClick?(): void;

  // Sets styling for the two inputs that are paired
  // in the buy/sell amm
  pairTop?: boolean;
  pairBottom?: boolean;
}

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
  small,
  pairTop,
  pairBottom,
  ...props
}: InputProps) => {
  const renderCrypto = () => {
    if (!crypto) {
      return null;
    }

    if (crypto.kind === 'value') {
      return <Ticker>{crypto.value}</Ticker>;
    }
    if (crypto.kind === 'select') {
      const {
        cryptoOptions,
        defaultValue,
        onCryptoChange,
        maxSelectorItems,
        inputValue,
      } = crypto;

      const optionalInputValue = inputValue ? { inputValue } : {};

      return (
        <InputSelect
          options={cryptoOptions}
          defaultValue={defaultValue}
          onChange={onCryptoChange}
          maxMenuItems={maxSelectorItems}
          {...optionalInputValue}
        />
      );
    }

    return null;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!handleChange) return;

    const val = event.target.value;

    // We need this extra validation here to catch multiple, or ending, dots
    if (isNumber) {
      const multiplePeriods = val.indexOf('.') != val.lastIndexOf('.');
      const endPeriod = val.charAt(val.length - 1) === '.';

      if (multiplePeriods) {
        event.preventDefault();
        return;
      }

      if (endPeriod) {
        // @ts-ignore  because here val ends in a dot, ex "12."
        handleChange(val);
        return;
      }
    }

    // @ts-ignore
    handleChange(val);
  };

  // we're using this for onKeyPress, instead of onChange otherwise
  // the cursor jumps around if someone is editing in the middle
  const numbersOnly = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!/\.|\d/.test(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <InputWrapper
      isDisabled={disabled}
      small={small}
      pairTop={pairTop}
      pairBottom={pairBottom}
    >
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
        small={small}
        onChange={handleInputChange}
        onKeyPress={isNumber ? numbersOnly : undefined}
        type={type}
        value={value}
        disabled={disabled}
        //@ts-ignore
        placeholder={0}
        {...props}
      />
    </InputWrapper>
  );
};

interface InputWrapperProps extends SizeProps {
  isDisabled?: boolean;
  /* TODO: refactor this to a Pair/Swap Component */
  pairTop?: boolean;
  pairBottom?: boolean;
}

export const InputWrapper = styled.div<InputWrapperProps>`
  display: flex;
  position: relative;
  margin-bottom: 0.2rem;
  padding: 0.5rem;
    background-color: ${(props) => props.theme.palette.dark};
  height: 6.5rem /* 104/16 */;
  border: 0.125rem  /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 100%;
  border-radius: 1rem;
  ${(props) => {
    const margin = props.small ? '-13px' : '-18px';
    if (props.pairTop) {
      return css`
        margin-bottom: ${margin};
        color: pink;
      `;
    }
    if (props.pairBottom) {
      return css`
        margin-top: ${margin};
        color: blue;
      `;
    }
  }}

  
  ${tabletAndAbove(`
    padding: 1rem 1.5rem /* 12/16 */;  
  `)}
}

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
  align-items: center;
  justify-content: space-around;
  width: 9.25rem /* 148/16 */;
`;

interface InputHintProps {
  hasAction: boolean;
}

export const InputHint = styled.small<InputHintProps>`
  color: ${theme.palette.brandLight};
  font-size: 10px;
  text-align: center;
  text-transform: uppercase;
  ${(props) =>
    props.hasAction &&
    css`
      background-color: ${(props) => props.theme.palette.brand50};
      padding: 0.0625rem /* 1/16 */ 0.25rem /* 4/16 */;
      border-radius: 0.25em;
      cursor: pointer;
    `}
`;

export const InputStyled = styled.input<SizeProps>`
  // common
  color: ${(props) => props.theme.palette.light};
  background-color: transparent;
  border: none;
  ${(props) => props.theme.typography.h3};
  color: ${theme.palette.brandLight};
  outline: none;
  width: 100%;
  height: 100%;
  text-align: right;
  padding-left: 1.5rem;
  ${({ small }) => small && `font-size: 1.5rem`};

  // remove input number controls ^ v
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  appearance: textfield;
`;

const Ticker = styled.p`
  margin: 0;
  color: ${theme.palette.brandLight};
  font-weight: bold;
`;
