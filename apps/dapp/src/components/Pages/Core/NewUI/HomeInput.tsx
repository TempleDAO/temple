import React, { InputHTMLAttributes, KeyboardEvent } from 'react';
import styled, { css } from 'styled-components';
import { phoneAndAbove, tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { InputSelect, Option, SelectTempleDaoOptions } from '../../../InputSelect/InputSelect';

import divider from 'assets/images/divider.svg';
import { pixelsToRems } from 'styles/mixins';
interface SizeProps {
  small?: boolean;
}

export interface CryptoSelector {
  kind: 'select';
  // A selector for the crypto, must provide onCryptoChange
  cryptoOptions: SelectTempleDaoOptions;
  defaultValue?: Option;
  // use to limit the number of elements shown in the selector at anytime
  maxSelectorItems?: number;

  // Callback for cryptoSelector value change
  onCryptoChange?(option: Option): void;
}

export interface CryptoValue {
  kind: 'value';
  value: string;
}

export interface InputProps extends SizeProps, InputHTMLAttributes<HTMLInputElement> {
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
  suffix,
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
      const { cryptoOptions, defaultValue, onCryptoChange, maxSelectorItems } = crypto;
      return (
        <InputSelect
          options={cryptoOptions}
          defaultValue={defaultValue}
          onChange={onCryptoChange}
          maxMenuItems={maxSelectorItems}
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
    <InputWrapper isDisabled={disabled}>
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
        suffix={suffix}
        {...props}
      />
      {suffix && <Suffix>{suffix}</Suffix>}
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
  padding: 0.7rem 0.5rem;
  background-color: ${(props) => props.theme.palette.dark};
  height: ${({ small }) => (small ? '3rem' : '4.5rem')};

  border: 0.125rem /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 90%;
  border-radius: 10px;

  ${tabletAndAbove(`
    padding: 0.7rem 1.5rem;
  `)}

  ${(props) =>
    props.isDisabled &&
    css`
      background-color: ${(props) => props.theme.palette.brand25};
    `}
`;

const InputTokenWrapper = styled.div<SizeProps>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  margin-left: -10px;
  // width: 7.25rem;

  min-width: ${pixelsToRems(120)}rem;
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
  font-size: ${pixelsToRems(10)}rem;
  text-align: center;
  text-transform: uppercase;
  width: max-content;

  ${(props) =>
    props.hasAction &&
    css`
      border-radius: 0.25em;
      padding: 0.0625rem 0.25rem;
      cursor: pointer;
    `}
`;

interface InputStyledProps extends SizeProps {
  suffix?: string;
}

export const InputStyled = styled.input<InputStyledProps>`
  // common
  ${theme.typography.h3};
  color: ${theme.palette.brand};
  background-color: transparent;
  font-size: 36px;
  border: none;
  outline: none;
  width: 100%;
  height: 100%;
  text-align: right;
  padding-left: 1.5rem;

  ${({ suffix, small }) =>
    suffix &&
    `padding-right:
    ${small ? `${suffix.length / 1.2}em` : `${suffix.length / 1.5}em`}`};

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

const Divider = styled.div`
  display: none;
  position: absolute;
  width: ${pixelsToRems(10)}rem;
  height: 80%;
  left: ${pixelsToRems(160)}rem;
  top: 10%;
  bottom: 10%;
  background: url(${divider});
  background-repeat: no-repeat;
  background-size: cover;

  ${phoneAndAbove(`
    display: inline-block;
  `)};
`;

const Suffix = styled.p<SizeProps>`
  ${theme.typography.h3};
  color: ${theme.palette.brandLight};
  ${({ small }) => small && `font-size: 1rem`};
  position: absolute;
  bottom: ${({ small }) => (small ? `0.1rem` : '0.8rem')};
  right: 0.75rem;
`;
