import React, { HTMLProps } from 'react';
import styled, { css } from 'styled-components';

interface ButtonProps extends ButtonStyledProps, HTMLProps<HTMLButtonElement> {
  type?: 'submit' | 'reset' | 'button' | undefined;
  label: string;

  onClick?(): void;
}

/**
 * Primary UI component for user interaction
 */
export const Button = ({
                         type = 'button',
                         label,
                         onClick,
                         isSmall = false,
                         isUppercase = false,
                         showArrow,
                         ...props
                       }: ButtonProps) => {
  return (
      // @ts-ignore expected multiple children
      <ButtonStyled
          type={type}
          onClick={onClick}
          isSmall={isSmall}
          isUppercase={isUppercase}
          showArrow={showArrow}
          {...props}
      >
        <ButtonLabel isUppercase={isUppercase} isSmall={isSmall}>
          {label}
        </ButtonLabel>
        {showArrow && <i>&#10146;</i>}
      </ButtonStyled>
  );
};

interface ButtonStyledProps {
  isSmall?: boolean;
  isUppercase?: boolean;
  showArrow?: boolean;
}

export const ButtonStyled = styled.button<ButtonStyledProps>`
  // common
  background-color: transparent;
  cursor: pointer;
  color: ${(props) => props.theme.palette.brand};
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  height: 4.75rem /* 76/16 */;
  ${(props) => props.theme.typography.meta};
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 1rem;

  ${(props) => props.isSmall && css`
    height: 2.625rem /* 42/16 */;
  `}

  ${(props) => props.showArrow && css`
    justify-content: space-between;
  `}
`;

export const ButtonLabel = styled.span<ButtonStyledProps>`
  margin: 0;
  ${(props) => props.isUppercase && css`
    text-transform: uppercase;
  `};
`;
