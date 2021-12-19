import React from 'react';
import styled, { keyframes } from 'styled-components';

const flicker = keyframes`
  0% {
    opacity: 0.3;
  }

  33% {
    opacity: 0.6;
  }

  60% {
    opacity: 0.4;
  }

  100% {
    opacity: 0.8;
  }
`;

export const BackgroundItem = styled.img`
  position: absolute;
  transform-origin: bottom left;
  opacity: 0.75;
  transition: opacity 150ms;
  &:hover {
    opacity: 1;
    cursor: pointer;
    animation: none;
  }
  animation: ${flicker} 3s infinite alternate ease-out;
  z-index: ${(props) => props.theme.zIndexes.up};
`;
