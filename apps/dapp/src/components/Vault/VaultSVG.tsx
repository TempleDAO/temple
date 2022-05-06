import { useRef, PropsWithChildren } from 'react';

import { VaultGroup, VaultRef } from './types';
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

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  return isDesktop ? (
    <VaultDesktop ref={vaultRef} vaultGroup={vaultGroup} selectedNav={selectedNav!} children={children} />
  ) : (
    <VaultMobile ref={vaultRef} vaultGroup={vaultGroup} selectedNav={selectedNav!} children={children} />
  );
};
