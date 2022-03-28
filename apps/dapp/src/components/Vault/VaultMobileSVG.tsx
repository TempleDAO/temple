import { useRef, useState, PropsWithChildren, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { Entry, Point, Vault, VaultPage } from './types';
import { processData } from './desktop-parts/utils';
import { pixelsToRems } from 'styles/mixins';
import {
  NAV_DESKTOP_HEIGHT_PIXELS,
  NAV_MOBILE_HEIGHT_PIXELS,
} from 'components/Layouts/CoreLayout/Header';
import { Maybe } from 'types/util';
import { Definitions } from './mobile-parts/Definitions';
import { Header } from './mobile-parts/Header';
import { Nav } from './mobile-parts/Nav';
import { Timeline } from './mobile-parts/Timeline';
import { Background } from './mobile-parts/Background';

type Props = {
  data: Vault;
};

const VAULT_PAGES: VaultPage[] = [
  'claim',
  'stake',
  'summary',
  'strategy',
  'timing',
];

const useSelectedVaultPage = (): Maybe<VaultPage> => {
  const { pathname } = useLocation();
  const pageName = VAULT_PAGES.find((page) => pathname.endsWith(page));

  useEffect(() => {
    if (!pageName) {
      console.error('Programming Error: Invalid page name');
    }
  }, [pageName]);

  return pageName;
};

export const VaultMobileSVG = ({
  data,
  children,
}: PropsWithChildren<Props>) => {
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
    </>
  );
};

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
