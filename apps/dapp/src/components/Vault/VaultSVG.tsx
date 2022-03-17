import { useRef, useState, PropsWithChildren, ReactNode } from 'react';
import styled from 'styled-components';

import { Definitions } from './parts/Definitions';
import { Background } from './parts/Background';
import { InnerRing } from './parts/InnerRing';
import { OuterRing } from './parts/OuterRing';
import { MarkerBubble } from './parts/MarkerBubble';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { Entry, Point, Vault } from './types';
import { processData } from './parts/utils';
import { RingButtons } from './parts/RingButtons';
import { Timeline } from './parts/timeline/Timeline';
import { pixelsToRems } from 'styles/mixins';
import { NAV_DESKTOP_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';

type Props = {
  data: Vault;
};

export const VaultSVG = ({ data, children }: PropsWithChildren<Props>) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const popupRef = useRef(null);
  const [selectedNav, setSelectedNav] = useState<number>(3);
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

  const child = children ? (
    (children as ReactNode[])[selectedNav - 1]
  ) : (
    <div>ERROR: Bad Nav</div>
  );

  const vault = processData(data);
  return (
    <>
      <BoundingBox>
        <svg height="100%" viewBox="0 0 1000 1000" fill="none" ref={svgRef}>
          <Background />
          <OuterRing selected={selectedNav} />
          <RingButtons selected={selectedNav} setSelected={setSelectedNav} />
          <Timeline data={vault} onMarkerClick={markerClick} />
          <InnerRing selected={selectedNav} />
          <ForeignObject x="239.5" y="239.5" width="520" height="520">
            <Content>{child}</Content>
          </ForeignObject>
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
  border-radius: 260px;
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
