import React, { FC, useEffect, useState, useCallback } from 'react';
import styled, { css } from 'styled-components';

interface RelicItemProps {
    label?: string;
    handleClick: () => void;
}

export const RelicItem: FC<RelicItemProps> = (props) => {

    return (
        <RelicItemBox
        onClick={props.handleClick}
        >
            {props.label}
        </RelicItemBox>
    );

}

const RelicItemBox = styled.div<RelicItemBox>`
  position: relative;
  z-index: ${(props) => props.theme.zIndexes.max};
  width: 40px;
  height: 40px;
  margin: 5px;
  flex-grow: 1;
  cursor: pointer;
  transition: color 250ms linear, background-color 250ms linear;

  ${(props) =>
    props.isDisabled &&
    css`
      filter: grayscale(1);
      pointer-events: none;
      cursor: not-allowed;
    `}

  background-color: ${(props) => props.theme.palette.dark};
  padding: 2rem;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  :hover {
    background-color: ${(props) => props.theme.palette.brand25};
  }
`;
interface RelicItemBox {
    isDisabled?: boolean;
  }