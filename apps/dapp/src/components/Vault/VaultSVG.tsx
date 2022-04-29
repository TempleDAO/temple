import { useRef, useState, PropsWithChildren } from 'react';

import { Entry, Point, VaultGroup, VaultRef } from './types';
import { useMediaQuery } from 'react-responsive';
import { VaultDesktop } from './VaultDesktop';
import { VaultMobile } from './VaultMobile';
import { useSelectedPage } from './useSelectedPage';
import { queryPhone } from 'styles/breakpoints';

type Props = {
  data: VaultGroup;
};

export const VaultSVG = ({ data: vault, children }: PropsWithChildren<Props>) => {
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
