import React, { PropsWithChildren } from 'react';
import styled, { css } from 'styled-components';

type LayoutOption =
  | 'space-around'
  | 'space-between'
  | 'space-evenly'
  | 'stretch'
  | 'center'
  | 'end'
  | 'flex-end'
  | 'flex-start'
  | 'start';

interface FlexContainer {
  kind: 'container';
  direction?: 'row' | 'column';
  canWrap?: boolean;
  canWrapTablet?: boolean;
  canWrapDesktop?: boolean;
  hidden?: boolean;
  hiddenTablet?: boolean;
  hiddenDesktop?: boolean;
  justifyContent?: LayoutOption;
  alignItems?: LayoutOption;
}

type Col =
  | 'half'
  | 'third'
  | 'quarter'
  | 'fifth'
  | 'three-quarter'
  | 'fullwidth';

interface FlexItem extends Omit<FlexContainer, 'kind'> {
  kind: 'item';
  col?: Col;
  colTablet?: Col;
  colDesktop?: Col;
  smallMargin?: boolean;
}

type Layout = FlexContainer | FlexItem;

interface FlexProps {
  layout: Layout;
  debug?: boolean;
  className?: string;
}

export const Flex = ({
  layout,
  debug,
  children,
  className,
}: PropsWithChildren<FlexProps>) => (
  <FlexStyled layout={layout} debug={debug} className={className}>
    {children}
  </FlexStyled>
);

export const FlexStyled = styled.div<PropsWithChildren<FlexProps>>`
  position: relative;
  display: flex;
  width: 100%;

  ${(props) =>
    props.debug &&
    css`
      background-color: ${(props) => props.theme.palette.brand25};
      border: 2px dashed tomato;
    `};

  ${(props) =>
    props.layout.kind === 'container' &&
    props.layout.canWrap &&
    css`
      flex-wrap: wrap;
    `};

  ${(props) =>
    props.layout.hidden &&
    css`
      display: none;
    `};


  ${(props) =>
    props.layout.kind === 'item' &&
    css`
      margin: 1rem;
      flex: 1;

      & + &,
      &:first-child {
        margin-left: 0;
      }

      &:last-child {
        margin-right: 0;
      }
    `};

  // FIXME(types) does not detect col on layout!!
  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.col === 'fullwidth' &&
    css`
      margin-right: 0;
      margin-left: 0;
      flex: 1 100%;
    `};
  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.col === 'three-quarter' &&
    css`
      flex: 1 75%;
      margin: 1rem 2rem;
    `};
  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.col === 'half' &&
    css`
      flex: 1 50%;
      margin: 1rem 2rem;
    `};
  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.col === 'third' &&
    css`
      flex: 1 33.333%;
      margin: 1rem 2rem;
    `};
  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.col === 'quarter' &&
    css`
      flex: 1 25%;
      margin: 1rem 2rem;
    `};

    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.col === 'fifth' &&
      css`
        flex: 1 20%;
        margin: 1rem 2rem;
      `};

  ${(props) =>
    props.layout.kind === 'item' &&
    props.layout.smallMargin &&
    props.layout.col !== 'fullwidth' &&
    css`
      margin: 0.25rem 0.75rem;
    `};
  
      
  ${(props) =>
    props.layout.kind === 'container' &&
    props.layout.canWrap &&
    css`
      flex-wrap: wrap;
    `};

  ${(props) =>
    props.layout.kind === 'container' &&
    props.layout.canWrap === false &&
    css`
      flex-wrap: nowrap;
    `};

  ${(props) =>
    props.layout.hidden &&
    css`
      display: none;
    `};

  @media screen and (min-width: 64rem  /* 1024/16 */
  ) {
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colTablet === 'fullwidth' &&
      css`
        margin-right: 0;
        margin-left: 0;
        flex: 1 100%;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colTablet === 'three-quarter' &&
      css`
        flex: 1 75%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colTablet === 'half' &&
      css`
        flex: 0 1 50%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colTablet === 'third' &&
      css`
        flex: 1 33.333%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colTablet === 'quarter' &&
      css`
        flex: 1 25%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'container' &&
      props.layout.canWrapTablet &&
      css`
        flex-wrap: wrap;
      `};
    ${(props) =>
      props.layout.kind === 'container' &&
      props.layout.canWrapTablet === false &&
      css`
        flex-wrap: nowrap;
      `};
    ${(props) =>
      props.layout.hiddenTablet &&
      css`
        display: none;
      `};
    ${(props) =>
      props.layout.hiddenTablet === false &&
      css`
        display: flex;
      `};
  }

  @media screen and (min-width: 90rem  /* 1440/16 */
  ) {
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colDesktop === 'fullwidth' &&
      css`
        margin-right: 0;
        margin-left: 0;
        flex: 1 100%;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colDesktop === 'three-quarter' &&
      css`
        flex: 1 75%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colDesktop === 'half' &&
      css`
        flex: 1 50%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colDesktop === 'third' &&
      css`
        flex: 1 33.333%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'item' &&
      props.layout.colDesktop === 'quarter' &&
      css`
        flex: 1 25%;
        margin: 1rem 2rem;
      `};
    ${(props) =>
      props.layout.kind === 'container' &&
      props.layout.canWrapDesktop &&
      css`
        flex-wrap: wrap;
      `};
    ${(props) =>
      props.layout.kind === 'container' &&
      props.layout.canWrapDesktop === false &&
      css`
        flex-wrap: nowrap;
      `};
    ${(props) =>
      props.layout.hiddenDesktop &&
      css`
        display: none;
      `};

    ${(props) =>
      props.layout.hiddenDesktop === false &&
      css`
        display: flex;
      `};
  }
}

${(props) =>
  props.layout.direction === 'column' &&
  css`
    flex-direction: column;
  `}

;
${(props) =>
  props.layout.justifyContent !== undefined &&
  css`
    justify-content: ${props.layout.justifyContent};
  `}

;
${(props) =>
  props.layout.alignItems !== undefined &&
  css`
    align-items: ${props.layout.alignItems};
  `}

;
`;
