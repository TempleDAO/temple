import { HTMLProps, MouseEvent, useState } from 'react';
import Image from 'components/Image/Image';
import styled, { css } from 'styled-components';

import Loader from '../Loader/Loader';
import useIsMounted from 'hooks/use-is-mounted';

export interface ButtonProps
  extends ButtonStyledProps,
    HTMLProps<HTMLButtonElement> {
  type?: 'submit' | 'reset' | 'button' | undefined;
  label?: string;
  loading?: boolean;

  onClick?(e?: MouseEvent): Promise<void> | void;
}

/**
 * Primary UI component for user interaction
 */
export const Button = ({
  type = 'button',
  label,
  leadingIcon,
  onClick,
  isSmall = false,
  isUppercase = false,
  showArrow,
  children,
  loading: externalLoading,
  ...props
}: ButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useIsMounted();

  /**
   * Click handler which shows a spinner while the action is in progress.
   * If button is already in progress then callback is not called.
   */
  const onClickHandler = async (e: MouseEvent) => {
    if (isLoading) {
      return;
    }
    if (!onClick) {
      return;
    }

    setIsLoading(true);
    try {
      await onClick(e);
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

  const loading = externalLoading || isLoading;
  const buttonContent = label || children;
  return (
    // @ts-ignore expected multiple children
    <ButtonStyled
      type={type}
      leadingIcon={leadingIcon}
      onClick={onClickHandler}
      isSmall={isSmall}
      isUppercase={isUppercase}
      showArrow={showArrow}
      {...props}
    >
      {loading ? (
        <Loader iconSize={32} />
      ) : (
        <>
          {leadingIcon && (
            <ButtonLeadingIcon
              src={leadingIcon}
              alt={''}
              width={24}
              height={24}
            />
          )}
          <ButtonLabel isUppercase={isUppercase} isSmall={isSmall}>
            {buttonContent}
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
  leadingIcon?: string;
  isActive?: boolean;
  // default takes fullwidth of parent
  autoWidth?: boolean;
}

const ButtonLeadingIcon = styled(Image)`
  margin: 0 0.3rem 0;
`;

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
  ${(props) =>
    props.leadingIcon &&
    css`
      justify-content: space-evenly;
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
