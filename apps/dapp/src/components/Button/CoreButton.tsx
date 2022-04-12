import { useState } from 'react';
import styled, { css } from 'styled-components';

import Loader from '../Loader/Loader';
import useIsMounted from 'hooks/use-is-mounted';

import { ButtonProps } from './Button';

/**
 * Primary UI component for user interaction
 */
export const CoreButton = ({
  type = 'button',
  label,
  onClick,
  isSmall = false,
  isUppercase = false,
  showArrow,
  ...props
}: ButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useIsMounted();

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
      // Make sure the component is still mounted after async code.
      // setting state on an unmounted component is a memory leak.
      if (!isMounted.current) {
        return;
      }

      setIsLoading(false);
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

const buttonHeight = '4.75rem';
export const ButtonStyled = styled.button<ButtonStyledProps>`
  // common
  background: ${(props) => props.theme.palette.gradients.dark};
  cursor: pointer;
  color: ${(props) => props.theme.palette.brandLight};
  border: 0.125rem /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  border-radius: calc(${buttonHeight} / 2);
  height: ${buttonHeight} /* 76/16 */;
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
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-weight: bold;
`;
