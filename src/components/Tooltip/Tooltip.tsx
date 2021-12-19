import React, { PropsWithChildren, ReactChild } from 'react';
import styled, { css } from 'styled-components';

export interface TooltipProps extends TooltipContentProps {
  content: ReactChild;
}

const Tooltip = ({
  content,
  position,
  children,
}: PropsWithChildren<TooltipProps>) => {
  return (
    <TooltipStyled>
      {children}
      <TooltipContent position={position}>{content}</TooltipContent>
    </TooltipStyled>
  );
};

export interface TooltipContentProps {
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TooltipContent = styled.p<TooltipContentProps>`
  position: absolute;
  opacity: 0;
  transition: opacity 250ms linear;
  ${(props) => props.theme.typography.meta};
  margin: 0;
  line-height: 1;
  padding: 0.5rem;
  width: 90vw;
  max-width: 20rem /* 320/16 */;
  background-color: ${(props) => props.theme.palette.brand};

  :before {
    content: '';
    position: absolute;
    background-color: ${(props) => props.theme.palette.brand};
    width: 1rem;
    height: 1rem;
    z-index: ${(props) => props.theme.zIndexes.below};
  }

  ${(props) =>
    props.position === 'top' &&
    css`
      bottom: calc(100% + 1rem);
      left: 50%;
      transform: translateX(-50%);

      :before {
        bottom: -0.5rem /* -8/16 */;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
      }
    `}
  ${(props) =>
    props.position === 'bottom' &&
    css`
      top: calc(100% + 1rem);
      left: 50%;
      transform: translateX(-50%);

      :before {
        top: -0.5rem /* -8/16 */;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
      }
    `}
  ${(props) =>
    props.position === 'left' &&
    css`
      right: calc(100% + 1rem);
      top: 50%;
      transform: translateY(-50%);

      :before {
        top: 50%;
        right: -0.5rem /* -8/16 */;
        transform: translateY(-50%) rotate(45deg);
      }
    `}
  ${(props) =>
    props.position === 'right' &&
    css`
      left: calc(100% + 1rem);
      top: 50%;
      transform: translateY(-50%);

      :before {
        top: 50%;
        left: -0.5rem /* -8/16 */;
        transform: translateY(-50%) rotate(45deg);
      }
    `}
`;

const TooltipStyled = styled.div`
  position: relative;
  overflow: hidden;

  &:hover {
    overflow: visible;
    ${TooltipContent} {
      opacity: 1;
    }
  }
`;

export const TooltipIcon = styled.small`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 100%;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
  border: 0.125rem /* 2/16 */ solid ${(props) => props.theme.palette.brand};

  :before {
    content: '¡';
    position: absolute;
    top: 0;
    font-weight: bold;
    font-size: 0.75rem;
  }
`;

export default Tooltip;
