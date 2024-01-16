import React, { InputHTMLAttributes, KeyboardEvent } from 'react';
import styled, { css } from 'styled-components';
import { tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

interface SizeProps {
  small?: boolean;
}

interface InputHintProps {
  hasAction: boolean;
}

export interface VaultInputProps
  extends SizeProps,
    InputHTMLAttributes<HTMLInputElement> {
  // ticker symbol used when displaying the value
  tickerSymbol?: string;
  // set our own type=number since we need type to be string
  // for proper display and input masking
  isNumber?: boolean;
  // extra information for the input
  hint?: string;
  onHintClick?(): void;
  // Callback for input value change
  handleChange?(value: number): void;
}

/**
 * UI component for use with vault
 */
export const VaultInput = ({
  handleChange,
  onHintClick,
  hint,
  tickerSymbol,
  isNumber,
  type,
  value,
  disabled,
  small,
  ...props
}: VaultInputProps) => {
  const rendertTickerSymbol = () => {
    if (!tickerSymbol) {
      return null;
    }

    return <Ticker>{tickerSymbol}</Ticker>;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!handleChange) return;

    const val = event.target.value;

    // We need this extra validation here to catch multiple, or ending, dots
    if (isNumber) {
      const multiplePeriods = val.indexOf('.') !== val.lastIndexOf('.');
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
        {rendertTickerSymbol()}
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
  padding: 0.5rem;
  background-color: ${(props) => props.theme.palette.dark};
  height: 6.5rem /* 104/16 */;
  border: 0.125rem  /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  // width will be manage by layout case by case
  width: 100%;
  border-radius: 1rem;

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
  align-items: flex-start;
  justify-content: space-around;
  width: 9.25rem /* 148/16 */;
`;

export const InputStyled = styled.input<SizeProps>`
  // common
  color: ${(props) => props.theme.palette.light};
  background-color: transparent;
  border: none;
  ${(props) => props.theme.typography.h3};
  color: ${theme.palette.brandLight};
  outline: none;
  font-size: 3rem;
  width: 100%;
  height: 100%;
  text-align: right;
  padding-left: 1.5rem;
  padding-bottom: 0.5rem;
  ${({ small }) => small && `font-size: 1.5rem`};

  // remove input number controls ^ v
  &[type='number']::-webkit-inner-spin-button,
  &[type='number']::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  appearance: textfield;
`;

export const InputHint = styled.small<InputHintProps>`
  color: ${theme.palette.brandLight};
  font-size: 12px;
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

const Ticker = styled.p`
  margin: 0;
  color: ${theme.palette.brandLight};
  font-size: 2rem;
  width: 100%;
`;
