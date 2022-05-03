import { useRef, useState, PropsWithChildren } from 'react';

import { Entry, Point, VaultGroup, VaultRef } from './types';
import { useMediaQuery } from 'react-responsive';
import { VaultDesktop } from './VaultDesktop';
import { VaultMobile } from './VaultMobile';
import { useSelectedPage } from './useSelectedPage';
import { queryPhone } from 'styles/breakpoints';

type Props = {
  vaultGroup: VaultGroup;
};

export const VaultSVG = ({ vaultGroup, children }: PropsWithChildren<Props>) => {
  const selectedNav = useSelectedPage();
  const vaultRef = useRef<VaultRef>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry>();
  const [markerPosition, setMarkerPosition] = useState<Point>({ x: 0, y: 0 });

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  const markerClick = (entryData: Entry, markerEl: SVGElement) => {
    console.log(`marker clicked: `, entryData);
  };

  return isDesktop ? (
    <VaultDesktop
      ref={vaultRef}
      vaultGroup={vaultGroup}
      selectedNav={selectedNav!}
      markerClick={markerClick}
      markerPosition={markerPosition}
      selectedEntry={selectedEntry!}
      children={children}
    />
  ) : (
    <VaultMobile
      ref={vaultRef}
      vaultGroup={vaultGroup}
      selectedNav={selectedNav!}
      markerClick={markerClick}
      markerPosition={markerPosition}
      selectedEntry={selectedEntry!}
      children={children}
    />
  );
};
