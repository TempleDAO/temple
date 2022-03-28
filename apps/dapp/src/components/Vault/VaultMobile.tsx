import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import styled from 'styled-components';
import { pixelsToRems } from 'styles/mixins';
import { Definitions } from './mobile-parts/Definitions';
import { Header } from './mobile-parts/Header';
import { Nav } from './mobile-parts/Nav';
import { Timeline } from './mobile-parts/Timeline';
import { VaultProps, VaultRef } from './types';

export const VaultMobile = forwardRef<VaultRef, VaultProps>(
  (
    {
      vault,
      selectedNav,
      markerClick,
      selectedEntry,
      markerPosition,
      children,
    },
    ref
  ) => {
    

    return (
      <BoundingBox>
        <Box>
          <Svg width="100%" viewBox="0 50 320 129" fill="none">
            <g clipPath="url(#clip0_4383_16241)">
              <path fill="#0B0A0A" d="M0 0h320v568H0z" />
              <g id="big-container">
                <Nav />
                <Header />
              </g>
            </g>
            <Definitions />
          </Svg>
        </Box>
        <Content>Content</Content>
        <Box>
          <Svg width="100%" viewBox="1 503 320 65" fill="none">
            <Timeline />
          </Svg>
        </Box>
      </BoundingBox>
    );
  }
);

const Svg = styled.svg`
  // border: 1px dashed yellow;
`;

const Box = styled.div`
  // border: 1px dashed white;
  // flex: 1;
`;

const BoundingBox = styled.div`
  // border: 1px solid green;
  width: 100vw;
  height: calc(100vh - ${NAV_MOBILE_HEIGHT_PIXELS}px);
  display: flex;
  flex-direction: column;
  margin: 0px;
  margin-top: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
`;

const Content = styled.div`
  // border: 1px solid red;
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  justify-content: center;
  margin-top: -20px; // This makes titles appear inside the curve a little
`;
