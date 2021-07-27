import React, { InputHTMLAttributes } from 'react';
import styled from 'styled-components';
import { formatNumber } from '../../utils/formatter';
import { InputSelect, Option, SelectTempleDaoOptions } from '../InputSelect/InputSelect';

interface CryptoSelector {
  kind: 'select'
  // A selector for the crypto, must provide onCryptoChange
  cryptoOptions: SelectTempleDaoOptions,
  defaultValue?: Option,

  // Callback for cryptoSelector value change
  onCryptoChange?(): void,
}

interface CryptoValue {
  kind: 'value';
  value: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // extra information for the input
  hint?: string,
  // options for the crypto in the input
  crypto?: CryptoSelector | CryptoValue,

  // Callback for input value change
  onChange(e: React.ChangeEvent<HTMLInputElement>): void,
}

/**
 * Primary UI component for user interaction
 */
export const Input = ({ onChange, hint, crypto, type, value, ...props }: InputProps) => {

  const renderCrypto = () => {
    if (!crypto) {
      return null;
    }

    if (crypto.kind === 'value') {
      return <h3>{crypto.value}</h3>;
    }
    if (crypto.kind === 'select') {
      const { cryptoOptions, defaultValue, onCryptoChange } = crypto;
      return <InputSelect options={cryptoOptions} defaultValue={defaultValue} onChange={onCryptoChange}/>;
    }

    return null;
  };

  return (
      <InputWrapper>
        <InputStyled onChange={onChange}
                     type={type}
                     value={type === 'number' && value ? formatNumber(+value) : value}
                     {...props} />
        <InputCrypto>
          {renderCrypto()}
        </InputCrypto>
        {hint && <InputHint>{hint}</InputHint>}
      </InputWrapper>
  );
};


const cryptoWidth = '12.5rem';

export const InputWrapper = styled.div`
  position: relative;
  margin-bottom: 2rem;
  padding: 0.75rem 2rem /* 12/16 */;
  background-color: ${(props) => props.theme.palette.brand25};
  height: 4.75rem /* 76/16 */;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 100%;

  h3 {
    margin: 0;
  }
`;

export const InputCrypto = styled.div`
  position: absolute;
  top: 0.75rem /* 6/16 */;
  right: 2rem;
  width: ${cryptoWidth};
  text-align: right;

  & > * {
    line-height: 1;
  }

  .Select__control {
    margin-top: -0.375rem /* -6/16 */;
    margin-right: -0.375rem /* -6/16 */;
  }
`;

export const InputHint = styled.small`
  position: absolute;
  bottom: 0.75rem /* 12/16 */;
  right: 2rem;
  color: ${(props) => props.theme.palette.light};
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

  // remove input number controls ^ v
  &[type=number]::-webkit-inner-spin-button,
  &[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 0;
  }
`;
