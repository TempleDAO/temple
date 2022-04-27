import { useRef, useState, PropsWithChildren } from 'react';

import { useOutsideClick } from '../../hooks/use-outside-click';
import { Entry, Point, Vault, VaultRef } from './types';
import { processData } from './desktop-parts/utils';
import { useMediaQuery } from 'react-responsive';
import { VaultDesktop } from './VaultDesktop';
import { VaultMobile } from './VaultMobile';
import { useSelectedPage } from './useSelectedPage';
import { queryPhone } from 'styles/breakpoints';

type Props = {
  data: Vault;
};

export const VaultSVG = ({ data, children }: PropsWithChildren<Props>) => {
  const selectedNav = useSelectedPage();
  const vaultRef = useRef<VaultRef>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry>();
  const [markerPosition, setMarkerPosition] = useState<Point>({ x: 0, y: 0 });

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  // useOutsideClick(vaultRef.current?.popupRef!, () => {
  //   setSelectedEntry(undefined);
  // });

  const markerClick = (entryData: Entry, markerEl: SVGElement) => {
    console.log(`marker clicked: `, entryData);
    // const markerBox = markerEl.getBoundingClientRect();
    // const markerCenterInScreenCoords = {
    //   x: markerBox.x + markerBox.width / 2,
    //   y: markerBox.y + markerBox.height / 2,
    // };

    // const point = DOMPoint.fromPoint(markerCenterInScreenCoords);
    // const marketCenterInSVGCoords = point.matrixTransform(
    //   vaultRef.current?.svgRef?.getScreenCTM()?.inverse()
    // );
    // // offset so the location is in the circle not the top left of bubble
    // marketCenterInSVGCoords.x -= 125;
    // marketCenterInSVGCoords.y -= 147;

    // setMarkerPosition(marketCenterInSVGCoords);
    // setSelectedEntry(entryData);
  };
  const vault = processData(data);
  return isDesktop ? (
    <VaultDesktop
      ref={vaultRef}
      vault={vault}
      selectedNav={selectedNav!}
      markerClick={markerClick}
      markerPosition={markerPosition}
      selectedEntry={selectedEntry!}
      children={children}
    />
  ) : (
    <VaultMobile
      ref={vaultRef}
      vault={vault}
      selectedNav={selectedNav!}
      markerClick={markerClick}
      markerPosition={markerPosition}
      selectedEntry={selectedEntry!}
      children={children}
    />
  );
};
