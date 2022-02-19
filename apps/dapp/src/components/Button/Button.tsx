import React, { HTMLProps, useState } from 'react';
import styled, { css } from 'styled-components';

import useIsMounted from 'hooks/use-is-mounted';
import Loader from '../Loader/Loader';

interface ButtonProps extends ButtonStyledProps, HTMLProps<HTMLButtonElement> {
  type?: 'submit' | 'reset' | 'button' | undefined;
  label: string;

  onClick?(): Promise<void> | void;
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
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useIsMounted();

  /**
   * Click handler which shows a spinner while the action is in progress.
   * If button is already in progress then callback is not called.
   */
  const onClickHandler = async () => {
    if (isLoading) {
      return;
    }

    if (!onClick) {
      return;
    }

    setIsLoading(true);
    try {
      await onClick();
    } catch (err) {
      /* TODO: Handle JSON-RPC errors better */
      // @ts-ignore
      if (err.code === 4001) {
        console.info(`Cancelled by user`);
      } else {
        console.info(`Error: ${JSON.stringify(err, null, 2)}`);
      }
    } finally {
      // Make sure component is mounted to avoid memory leaks.
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    // @ts-ignore expected multiple children
    <ButtonStyled
      type={type}
      onClick={onClickHandler}
      isSmall={isSmall}
      isUppercase={isUppercase}
      showArrow={showArrow}
      {...props}
    >
      {isLoading ? (
        <Loader iconSize={32} />
      ) : (
        <>
          <ButtonLabel isUppercase={isUppercase} isSmall={isSmall}>
            {label}
          </ButtonLabel>
          {showArrow && <i>&#10146;</i>}
        </>
      )}
    </ButtonStyled>
  );
};

interface ButtonStyledProps {
  isSmall?: boolean;
  isUppercase?: boolean;
  showArrow?: boolean;
  isActive?: boolean;
  // default takes fullwidth of parent
  autoWidth?: boolean;
}

export const ButtonStyled = styled.button<ButtonStyledProps>`
  // common
  background-color: transparent;
  cursor: pointer;
  color: ${(props) => props.theme.palette.brand};
  border: 0.0625rem /* 1/16 */ solid currentColor;
  height: 4.75rem /* 76/16 */;
  ${(props) => props.theme.typography.h4};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 1rem;
  transition: color 250ms linear, background-color 250ms linear;

  ${(props) =>
    !props.autoWidth &&
    css`
      width: 100%;
    `}
  ${(props) =>
    props.isSmall &&
    css`
      ${(props) => props.theme.typography.meta};
      height: 2.625rem /* 42/16 */;
    `}
  ${(props) =>
    props.showArrow &&
    css`
      justify-content: space-between;
    `}
  &:disabled {
    color: ${(props) => props.theme.palette.brand50};
    cursor: default;
  }

  ${(props) =>
    props.isActive &&
    css`
      background-color: ${(props) => props.theme.palette.brand};
      color: ${(props) => props.theme.palette.light};
    `};

  :hover:not(:disabled) {
    ${(props) =>
      !props.isActive &&
      css`
        background-color: ${(props) => props.theme.palette.brand25};
      `};
  }
`;

export const ButtonLabel = styled.span<ButtonStyledProps>`
  margin: 0;
  ${(props) =>
    props.isUppercase &&
    css`
      text-transform: uppercase;
    `};
`;
