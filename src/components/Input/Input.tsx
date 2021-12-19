import React, { InputHTMLAttributes } from 'react';
import styled, { css } from 'styled-components';
import { formatNumber } from 'utils/formatter';
import {
  InputSelect,
  Option,
  SelectTempleDaoOptions,
} from '../InputSelect/InputSelect';

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

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // extra information for the input
  hint?: string;
  // options for the crypto in the input
  crypto?: CryptoSelector | CryptoValue;

  // Callback for input value change
  handleChange?(value: number): void;

  onHintClick?(): void;
}

/**
 * Primary UI component for user interaction
 */
export const Input = ({
  handleChange,
  onHintClick,
  hint,
  crypto,
  type,
  value,
  disabled,
  ...props
}: InputProps) => {
  const renderCrypto = () => {
    if (!crypto) {
      return null;
    }

    if (crypto.kind === 'value') {
      return <h3>{crypto.value}</h3>;
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
    const x = +event.target.value > 0 ? +event.target.value : 0;
    if (handleChange) {
      handleChange(x);
    }
  };

  return (
    <InputWrapper isDisabled={disabled}>
      <InputStyled
        onChange={handleInputChange}
        type={type}
        value={type === 'number' && value ? formatNumber(+value) : value}
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

interface InputWrapperProps {
  isDisabled?: boolean;
}

export const InputWrapper = styled.div<InputWrapperProps>`
  position: relative;
  margin-bottom: 0.5rem;
  padding: 0 2rem /* 12/16 */;
  background-color: ${(props) => props.theme.palette.brand25};
  height: 4.75rem /* 76/16 */;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 100%;

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

export const InputStyled = styled.input`
  // common
  cursor: pointer;
  color: ${(props) => props.theme.palette.light};
  background-color: transparent;
  border: none;
  ${(props) => props.theme.typography.h3};
  outline: none;
  width: 100%;
  height: 100%;
  text-align: right;

  // remove input number controls ^ v
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 0;
  }
`;
