import React, { InputHTMLAttributes, KeyboardEvent } from 'react';
import styled, { css } from 'styled-components';
import {
  InputSelect,
  Option,
  SelectTempleDaoOptions,
} from '../InputSelect/InputSelect';

interface SizeProps {
  small?: boolean;
}
interface CryptoSelector {
  kind: 'select';
  // A selector for the crypto, must provide onCryptoChange
  cryptoOptions: SelectTempleDaoOptions;
  defaultValue?: Option;

  // Callback for cryptoSelector value change
  onCryptoChange?(): void;
}

interface CryptoValue {
  kind: 'value';
  value: string;
}

interface InputProps extends SizeProps, InputHTMLAttributes<HTMLInputElement> {
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
      return <Ticker small={small}>{crypto.value}</Ticker>;
    }
    if (crypto.kind === 'select') {
      const { cryptoOptions, defaultValue, onCryptoChange } = crypto;
      return (
        <InputSelect
          options={cryptoOptions}
          defaultValue={defaultValue}
          onChange={onCryptoChange}
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
      <InputStyled
        small={small}
        onChange={handleInputChange}
        onKeyPress={isNumber ? numbersOnly : undefined}
        type={type}
        value={value}
        disabled={disabled}
        {...props}
      />
      <InputCrypto>{renderCrypto()}</InputCrypto>
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
    </InputWrapper>
  );
};

interface InputWrapperProps extends SizeProps {
  isDisabled?: boolean;
  pairTop?: boolean;
  pairBottom?: boolean;
}

export const InputWrapper = styled.div<InputWrapperProps>`
  position: relative;
  margin-bottom: 0.2rem;
  padding: 0 2rem /* 12/16 */;
  background-color: ${(props) => props.theme.palette.brand25};
  height: ${({ small }) => (small ? '4' : '4.75')}rem;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 100%;
  ${(props) => {
    if (props.pairTop) {
      return css`
        margin-bottom: -13px;
        color: pink;
      `;
    }
    if (props.pairBottom) {
      return css`
        margin-top: -13px;
        color: blue;
      `;
    }
  }}}

  ${(props) =>
    props.isDisabled &&
    css`
      background-color: ${(props) => props.theme.palette.dark};
    `}
`;

export const InputCrypto = styled.div`
  position: absolute;
  top: 0.5rem /* 6/16 */;
  left: 2rem;
  text-align: left;
  width: 10.5rem;

  h3 {
    margin: 0;
    width: auto;
  }

  & > * {
    line-height: 1;
  }

  .Select__control {
    margin-top: -0.375rem /* -6/16 */;
    margin-right: -0.375rem /* -6/16 */;
  }
`;

interface InputHintProps {
  hasAction: boolean;
}

export const InputHint = styled.small<InputHintProps>`
  position: absolute;
  bottom: 0.75rem /* 12/16 */;
  left: 2rem;
  color: ${(props) => props.theme.palette.light};
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
  outline: none;
  width: 100%;
  height: 100%;
  text-align: right;
  ${({ small }) => small && `font-size: 1.5rem`};

  // remove input number controls ^ v
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  appearance: textfield;
`;

const Ticker = styled.h3<SizeProps>`
  display: inline-block;
  ${({ small }) => small && 'font-size: 1.2rem'};
`;
