import React from 'react';
import styled from 'styled-components';

export const Background = styled.img`
  height: 100vh;
  width: 100vw;
  object-fit: cover;
  object-position: bottom center;
  position: absolute;
  pointer-events: none;
  z-index: ${(props) => props.theme.zIndexes.base};
`;
