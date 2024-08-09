import { forwardRef, useImperativeHandle, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

import { Definitions } from './desktop-parts/Definitions';
import { Background } from './desktop-parts/Background';
import { InnerRing } from './desktop-parts/InnerRing';
import { OuterRing } from './desktop-parts/OuterRing';
import { RingButtons } from './desktop-parts/RingButtons';
import { Timeline } from './desktop-parts/timeline/Timeline';
import { pixelsToRems } from 'styles/mixins';
import { NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { VaultProps, VaultRef } from './types';

// eslint-disable-next-line react/display-name
export const VaultDesktop = forwardRef<VaultRef, VaultProps>(
  ({ selectedNav, children }, ref) => {
    const { vaultGroup } = useVaultContext();
    const svgRef = useRef<SVGSVGElement>(null);
    const popupRef = useRef(null);

    useImperativeHandle(ref, () => ({
      get svgRef() {
        return svgRef.current;
      },
      get popupRef() {
        return popupRef.current;
      },
    }));

    const navigate = useNavigate();
    return (
      <BoundingBox>
        <svg height="100%" viewBox="0 0 1000 1000" fill="none" ref={svgRef}>
          <Background />
          <OuterRing selected={selectedNav} />
          <RingButtons
            selected={selectedNav}
            onClickButton={(page) => {
              navigate(`/dapp/vaults/${vaultGroup!.id}/${page}`);
            }}
          />
          <Timeline />
          <InnerRing selected={selectedNav} />
          <ForeignObject x="241.5" y="239.5" width="520" height="520">
            <Content>{children}</Content>
          </ForeignObject>
          <Definitions />
        </svg>
      </BoundingBox>
    );
  }
);

// Need to 'trim' the corners on this square
// otherwise the corners cover some of the ring buttons.
// TODO Long Term: SVG should have a "circular hole" in it so
// we can simply layer things correctly.
const ForeignObject = styled.foreignObject`
  border-radius: 50%;
  overflow: hidden;
`;

const BoundingBox = styled.div`
  height: calc(100vh - ${NAV_DESKTOP_HEIGHT_PIXELS}px);
  display: flex;
  margin: 0 auto;
  flex-direction: column;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate3d(-50%, -50%, 0);
`;

const Content = styled.div`
  display: flex;
  height: 100%;
  border-radius: ${pixelsToRems(260)}rem;
  overflow: hidden;
  justify-content: center;
  padding-top: ${pixelsToRems(10)}rem;
`;
