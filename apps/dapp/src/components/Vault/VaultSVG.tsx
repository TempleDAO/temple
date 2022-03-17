import { useRef, useState, PropsWithChildren, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate, useResolvedPath } from 'react-router-dom';

import { Definitions } from './parts/Definitions';
import { Background } from './parts/Background';
import { InnerRing } from './parts/InnerRing';
import { OuterRing } from './parts/OuterRing';
import { MarkerBubble } from './parts/MarkerBubble';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { Entry, Point, Vault, VaultPage } from './types';
import { processData } from './parts/utils';
import { RingButtons } from './parts/RingButtons';
import { Timeline } from './parts/timeline/Timeline';
import { pixelsToRems } from 'styles/mixins';
import { NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { Maybe } from 'types/util';

type Props = {
  data: Vault;
};

const VAULT_PAGES: VaultPage[] = ['claim', 'stake', 'summary', 'strategy', 'timing'];

const useSelectedVaultPage = (): Maybe<VaultPage> => {
  const { pathname } = useLocation();
  const pageName = VAULT_PAGES.find((page) => pathname.endsWith(page));

  useEffect(() => {
    if (!pageName) {
      console.error('Programming Error: Invalid page name')
    }
  }, [pageName]);

  return pageName;
};

export const VaultSVG = ({ data, children }: PropsWithChildren<Props>) => {
  const navigate = useNavigate();
  const selectedNav = useSelectedVaultPage();
  const svgRef = useRef<SVGSVGElement>(null);
  const popupRef = useRef(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry>();
  const [markerPosition, setMarkerPosition] = useState<Point>({ x: 0, y: 0 });
  useOutsideClick(popupRef, () => {
    setSelectedEntry(undefined);
  });

  const markerClick = (entryData: Entry, markerEl: SVGElement) => {
    const markerBox = markerEl.getBoundingClientRect();
    const markerCenterInScreenCoords = {
      x: markerBox.x + markerBox.width / 2,
      y: markerBox.y + markerBox.height / 2,
    };

    const point = DOMPoint.fromPoint(markerCenterInScreenCoords);
    const marketCenterInSVGCoords = point.matrixTransform(
      svgRef.current?.getScreenCTM()?.inverse()
    );
    // offset so the location is in the circle not the top left of bubble
    marketCenterInSVGCoords.x -= 125;
    marketCenterInSVGCoords.y -= 147;

    setMarkerPosition(marketCenterInSVGCoords);
    setSelectedEntry(entryData);
  };

  const vault = processData(data);
  return (
    <>
      <BoundingBox>
        <svg height="100%" viewBox="0 0 1000 1000" fill="none" ref={svgRef}>
          <Background />
          <OuterRing selected={0} />
          <RingButtons
            selected={selectedNav}
            onClickButton={(page) => {
              navigate(`/core/vaults/${data.id}/${page}`);
            }}
          />
          <Timeline data={vault} onMarkerClick={markerClick} />
          <InnerRing selected={selectedNav} />
          <foreignObject x="239.5" y="239.5" width="520" height="520">
            <Content>{children}</Content>
          </foreignObject>
          <Definitions />
          {selectedEntry && (
            <MarkerBubble
              ref={popupRef}
              months={vault.months}
              entry={selectedEntry}
              position={markerPosition}
            />
          )}
        </svg>
      </BoundingBox>
    </>
  );
};

// Need to 'trim' the corners on this square
// otherwise the corners cover some of the ring buttons.
// TODO Long Term: SVG should have a "circular hole" in it so
// we can simply layer things correctly.
const ForeignObject = styled.foreignObject`
  border-radius: 50%;
`;

const BoundingBox = styled.div`
  height: calc(100vh - ${NAV_DESKTOP_HEIGHT_PIXELS}px);
  display: flex;
  margin: 0 auto;
  flex-direction: column;
  position: relative;
`;

const Content = styled.div`
  display: flex;
  height: 100%;
  border-radius: ${pixelsToRems(260)}rem;
  overflow: hidden;
  justify-content: center;
  padding-top: ${pixelsToRems(10)}rem;
`;
