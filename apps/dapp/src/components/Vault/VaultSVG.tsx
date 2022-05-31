import { useRef, FC } from 'react';

import { VaultRef } from './types';
import { useMediaQuery } from 'react-responsive';
import { VaultDesktop } from './VaultDesktop';
import { VaultMobile } from './VaultMobile';
import { useSelectedPage } from './useSelectedPage';
import { queryPhone } from 'styles/breakpoints';

export const VaultSVG: FC = ({ children }) => {
  const selectedNav = useSelectedPage();
  const vaultRef = useRef<VaultRef>(null);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  return isDesktop ? (
    <VaultDesktop ref={vaultRef} selectedNav={selectedNav!} children={children} />
  ) : (
    <VaultMobile ref={vaultRef} selectedNav={selectedNav!} children={children} />
  );
};
