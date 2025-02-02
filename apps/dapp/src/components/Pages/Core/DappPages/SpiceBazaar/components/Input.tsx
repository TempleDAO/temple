import React, { InputHTMLAttributes, KeyboardEvent } from 'react';
import styled, { css } from 'styled-components';
import { theme } from 'styles/theme';

interface InputStyledProps {
  valueFontSize?: string;
  valueLineHeight?: string;
}

interface SizeProps {
  small?: boolean;
  width?: number | string | undefined;
}

export interface CryptoValue {
  kind: 'value';
  value: string;
}

export interface InputProps
  extends SizeProps,
    InputHTMLAttributes<HTMLInputElement> {
  hint?: string;
  crypto?: CryptoValue;
  isNumber?: boolean;

  // Callback for input value change
  handleChange?(value: number | string): void;

  onHintClick?(): void;
  suffix?: string;

  valueFontSize?: string;
  valueLineHeight?: string;
}

export const Input = ({
  handleChange,
  onHintClick,
  hint,
  crypto,
  isNumber,
  type,
  value,
  disabled,
  valueFontSize,
  valueLineHeight,
  ...props
}: InputProps) => {
  const renderCrypto = () => {
    if (!crypto) return null;
    if (crypto.kind === 'value') return <Ticker>{crypto.value}</Ticker>;
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
        valueFontSize={valueFontSize}
        valueLineHeight={valueLineHeight}
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
  box-sizing: border-box;
  background-color: ${(props) => props.theme.palette.dark};
  border: 1px solid ${(props) => props.theme.palette.brand};
  width: ${({ width }) => width || '90%'};
  border-radius: 10px;
  padding: 10px;
  gap: 10px;

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
  justify-content: center;
  align-items: left;
  gap: 5px;
`;

interface InputHintProps {
  hasAction: boolean;
}

export const InputHint = styled.small<InputHintProps>`
  color: ${theme.palette.brand};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  text-align: center;
  width: max-content;
  margin-top: 0.15rem;

  ${(props) =>
    props.hasAction &&
    css`
      border-radius: 0.25em;
      cursor: pointer;
    `}
`;

export const InputStyled = styled.input<InputStyledProps>`
  ${theme.typography.fonts.fontHeading};
  color: ${theme.palette.brand};
  background-color: transparent;
  border: none;
  outline: none;
  width: 100%;
  font-size: ${({ valueFontSize }) =>
    valueFontSize || '18px'}; // Use the prop or default to 18px
  line-height: ${({ valueLineHeight }) =>
    valueLineHeight || '33px'}; // Use the prop or default to 33px
  font-weight: 400;
  letter-spacing: 0.05em;
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

const Ticker = styled.h3`
  font-size: 18px;
  font-weight: 400;
  line-height: 33px;
  text-wrap: nowrap;
  margin: 0;
  color: ${theme.palette.brandLight};
`;
