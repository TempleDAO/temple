import { useRef, useState, PropsWithChildren, useEffect } from 'react';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { Entry, Point, Vault, VaultPage, VaultRef } from './types';
import { processData } from './desktop-parts/utils';
import { useMediaQuery } from 'react-responsive';
import { theme } from 'styles/theme';
import { VaultDesktop } from './VaultDesktop';
import { VaultMobile } from './VaultMobile';
import { useSelectedPage } from './useSelectedPage';
import { Maybe } from 'types/util';
import { useLocation } from 'react-router-dom';

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

export const VaultSVG = ({ data, children }: PropsWithChildren<Props>) => {
  const selectedNav = useSelectedPage();
  const vaultRef = useRef<VaultRef>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry>();
  const [markerPosition, setMarkerPosition] = useState<Point>({ x: 0, y: 0 });

  const isDesktop = useMediaQuery({
    query: `(min-width: ${theme.metrics.devices.tablet})`,
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
