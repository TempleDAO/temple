import { useEffect, useRef, useState, PropsWithChildren } from 'react';
import styled from 'styled-components';
import { Definitions } from './parts/Definitions';
import { Background } from './parts/Background';
import { InnerRing } from './parts/InnerRing';
import { OuterRing } from './parts/OuterRing';
import { MarkerBubble } from './parts/MarkerBubble';
import { createGlobalStyle } from 'styled-components';
import megante from './parts/assets/megante.ttf';
import caviar from './parts/assets/caviardreams.ttf';

import { useContentBox } from './useContentBox';
import { useOutsideClick } from './useOutsideClick';
import { Box, Entry, Point, Vault } from './types';
import { processData } from './parts/utils';
import { RingButtons } from './parts/RingButtons';
import { Timeline } from './parts/timeline/Timeline';

type Props = {
  data: Vault;
};

export const VaultSVG = ({ data, children }: PropsWithChildren<Props>) => {
  const svgRef = useRef(null);
  const popupRef = useRef(null);
  const [selectedNav, setSelectedNav] = useState<number>(3);
  const [selectedEntry, setSelectedEntry] = useState<Entry>();
  const [markerPosition, setMarkerPosition] = useState<Point>({ x: 0, y: 0 });
  const box = useContentBox(svgRef);
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
      // @ts-ignore
      svgRef.current?.getScreenCTM().inverse()
    );
    // offset so the location is in the circle not the top left of bubble
    marketCenterInSVGCoords.x -= 125;
    marketCenterInSVGCoords.y -= 147;

    setMarkerPosition(marketCenterInSVGCoords);
    setSelectedEntry(entryData);
  };

  const child = children ? (
    // @ts-ignore
    children[selectedNav - 1]
  ) : (
    <div>ERROR: Bad Nav</div>
  );

  const vault = processData(data);
  return (
    <>
      <GlobalStyle />
      <BoundingBox>
        {/* @ts-ignore */}
        <Content {...box}>{child}</Content>
        <Svg height="100%" viewBox="0 0 1000 1000" fill="none" ref={svgRef}>
          <Background />
          <OuterRing
            data={vault}
            selected={selectedNav}
            setSelected={setSelectedNav}
            onMarkerClick={markerClick}
          />
          <RingButtons selected={selectedNav} setSelected={setSelectedNav} />
          <Timeline data={vault} onMarkerClick={markerClick} />
          <InnerRing selected={selectedNav} />
          <Definitions />
          {selectedEntry && (
            <MarkerBubble
              ref={popupRef}
              months={vault.months}
              entry={selectedEntry}
              position={markerPosition}
            />
          )}
        </Svg>
      </BoundingBox>
    </>
  );
};

const Svg = styled.svg`
  // border: 1px dashed yellow;
`;

const BoundingBox = styled.div`
  // border: 1px solid red;
  height: 100vh;
  display: inline-flex;
  flex-direction: column;
  position: relative;
`;

const Content = styled.div`
  // border: 1px solid red;
  position: absolute;
  border-radius: 250px;
  left: ${(props: Box) => props.left + 'px'};
  top: ${(props: Box) => props.top + 'px'};
  width: ${(props: Box) => props.width + 'px'};
  height: ${(props: Box) => props.height + 'px'};
  overflow: hidden;

  display: flex;
  justify-content: center;
  padding-top: 10px;
`;

// TODO move this, or confirm if these fonts are already loaded elsewhere
const GlobalStyle = createGlobalStyle`
@font-face {
  font-family: 'Megante';
  src: url('${megante}') format('woff');
  font-style: normal;
  font-weight: 400;
  font-display: fallback; /* <- this can be added to each @font-face definition */
}
@font-face {
  font-family: 'Caviar Dreams';
  src: url('${caviar}') format('woff');
  font-style: normal;
  font-weight: 400;
  font-display: fallback; /* <- this can be added to each @font-face definition */
}
`;
