import React, { PropsWithChildren } from 'react';
import styled, { css } from 'styled-components';

import Tippy from '@tippyjs/react';
import { roundArrow, Placement } from 'tippy.js';
import 'tippy.js/animations/scale-subtle.css';
import 'tippy.js/dist/svg-arrow.css';

export interface TooltipProps {
  content: React.ReactNode;
  position?: Placement;
  trigger?: string;
  delay?: number;
  offset?: [number, number];
  animationDuration?: number;
  inline?: boolean;
}

const Tooltip = ({
  content,
  position,
  trigger,
  delay,
  offset,
  animationDuration,
  children,
  inline = false,
}: PropsWithChildren<TooltipProps>) => {
  return (
    <TippyStyled
      content={content}
      animation={'scale-subtle'}
      trigger={trigger}
      delay={delay}
      duration={animationDuration ? animationDuration : 250}
      offset={offset}
      arrow={roundArrow}
      placement={position}
    >
      <ChildrenWrapper inline={inline}>{children}</ChildrenWrapper>
    </TippyStyled>
  );
};

export const TooltipIcon = () => {
  return <TooltipIconStyled>¡</TooltipIconStyled>;
};

const tippyStyles = css`
  ${(props) => props.theme.typography.meta};
  background: ${({ theme }) => theme.palette.brand};
  padding: 0.5rem;
  svg {
    fill: ${({ theme }) => theme.palette.brand};
  }
`;

export const TippyDiv = styled.div`
  ${tippyStyles}
`;

const TippyStyled = styled(Tippy)`
  ${tippyStyles}
`;

const TooltipIconStyled = styled.small`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 1rem;
  height: 1rem;
  border-radius: 100%;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
  border: 0.125rem /* 2/16 */ solid ${(props) => props.theme.palette.brand};
  user-select: none;
  cursor: help;
`;

const ChildrenWrapper = styled.div<{ inline?: boolean }>`
  display: ${(props) => (props.inline ? 'inline-flex' : 'flex')};
  cursor: pointer;
`;

export default Tooltip;
