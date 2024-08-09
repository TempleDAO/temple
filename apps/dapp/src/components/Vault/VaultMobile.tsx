import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { pixelsToRems } from 'styles/mixins';
import { Definitions } from './mobile-parts/Definitions';
import { Header } from './mobile-parts/Header';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { Nav } from './mobile-parts/Nav';
import { Timeline } from './mobile-parts/Timeline';
import { VaultProps, VaultRef } from './types';

// eslint-disable-next-line react/display-name
export const VaultMobile = forwardRef<VaultRef, VaultProps>(
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
        <div>
          <svg width="100%" viewBox="0 50 320 129" fill="none">
            <Nav
              selected={selectedNav}
              onClickButton={(page) => {
                navigate(`/dapp/vaults/${vaultGroup!.id}/${page}`);
              }}
            />
            <Header />
            <Definitions />
          </svg>
        </div>
        <Content>{children}</Content>
        <div>
          <svg width="100%" viewBox="1 503 320 65" fill="none">
            <Timeline />
          </svg>
        </div>
      </BoundingBox>
    );
  }
);

const BoundingBox = styled.div`
  width: 100vw;
  height: calc(100vh - ${NAV_MOBILE_HEIGHT_PIXELS}px);
  display: flex;
  flex-direction: column;
  margin: 0px;
  margin-top: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
`;

const Content = styled.div`
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  justify-content: center;
  margin-top: ${pixelsToRems(
    -20
  )}rem; // This should make titles appear inside the curve a little
`;
