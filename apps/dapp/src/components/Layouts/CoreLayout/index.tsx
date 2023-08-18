import { FC, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import { useWallet } from 'providers/WalletProvider';

import Header from './Header';
import { NexusSoundscape } from 'components/Pages/Nexus/NexusSoundscape';

import libraryShelfImage from 'assets/images/nexus/Library_Shelves5.png';
import highlightTopRight from 'assets/images/nexus/Library_Shelves_top_right.png';
import highlightTopLeft from 'assets/images/nexus/Library_Shelves_top_left.png';
import highlightMiddle from 'assets/images/nexus/Library_Shelves_middle.png';
import highlightBottomLeft from 'assets/images/nexus/Library_Shelves_bottom_left.png';
import highlightBottomMiddle from 'assets/images/nexus/Library_Shelves_bottom_center.png';
import highlightBottomRight from 'assets/images/nexus/Library_Shelves_bottom_right.png';
import book1 from 'assets/images/nexus/book1-onepage.png';
import book2 from 'assets/images/nexus/book2-onepage.png';
import book3 from 'assets/images/nexus/book3-onepage.png';
import book4 from 'assets/images/nexus/book4-onepage.png';
import book5 from 'assets/images/nexus/book5-onepage.png';
import book6 from 'assets/images/nexus/book6-onepage.png';
import usePreloadImages from 'hooks/use-preload-images';

type CoreLayoutProps = {
  mode: 'dapp' | 'nexus';
  headless?: boolean;
};

const CoreLayout: FC<CoreLayoutProps> = (props) => {
  const { isConnected } = useWallet();
  const [_, resfreshWalletState] = useRefreshWalletState();
  const didRefreshRefresh = useRef(false);

  useEffect(() => {
    if (didRefreshRefresh.current) {
      return;
    }

    if (isConnected) {
      resfreshWalletState();
      didRefreshRefresh.current = true;
    }
  }, [isConnected, didRefreshRefresh]);

  const NEXUS_IMAGE = [
    libraryShelfImage,
    highlightBottomLeft,
    highlightBottomMiddle,
    highlightBottomRight,
    highlightMiddle,
    highlightTopLeft,
    highlightTopRight,
    book1,
    book2,
    book3,
    book4,
    book5,
    book6,
  ];

  usePreloadImages(NEXUS_IMAGE);

  return (
    <>
      {!props.headless && <Header mode={props.mode} />}
      {props.mode === 'nexus' && <NexusSoundscape />}
      <Main>
        <Outlet />
      </Main>
    </>
  );
};

export default CoreLayout;

const Main = styled.main`
  margin: 0 auto;
  padding: 0px;

  ${phoneAndAbove(`
    max-width: ${theme.metrics.desktop.maxWidth};
  `)}
`;
