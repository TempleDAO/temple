import { Buy } from 'components/AMM/Buy';
import Devotion from 'components/AMM/Devotion';
import { Queue } from 'components/AMM/Queue';
import { Sell } from 'components/AMM/Sell';
import { Stake } from 'components/AMM/Stake';
import { Withdraw } from 'components/AMM/Withdraw';
import { Unlock } from 'components/AMM/Unlock';
import { Nav } from 'components/DApp/Nav';
import { Profile } from 'components/DApp/Profile';
import {
  Container,
  Main,
  MenuBar,
  MenuImage,
  MobileContainer,
} from 'components/DApp/NavComponents';
import { NavContext } from 'components/DApp/NavContext';
import { DAppView } from 'enums/dapp-view';
import React, { FC, useContext, useEffect, useRef, useState } from 'react';

interface DAppProps {
  small?: boolean;
}

export const DApp: FC<DAppProps> = ({ small }) => {
  const menuRef = useRef() as React.MutableRefObject<HTMLElement>;
  const { activeView, setView } = useContext(NavContext);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const checkIfClickedOutside = (e: globalThis.MouseEvent) => {
      if (
        menuVisible &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuVisible(false);
      }
    };

    document.addEventListener('mousedown', checkIfClickedOutside);

    return () => {
      document.removeEventListener('mousedown', checkIfClickedOutside);
    };
  }, [menuVisible]);

  let CurrentView;

  switch (activeView) {
    case DAppView.BUY:
      CurrentView = (
        <Buy onSwapArrowClick={() => setView(DAppView.SELL)} small />
      );
      break;
    case DAppView.STAKE:
      CurrentView = <Stake small />;
      break;
    case DAppView.QUEUE:
      CurrentView = <Queue small />;
      break;
    case DAppView.WITHDRAW:
      CurrentView = <Withdraw small />;
      break;
    case DAppView.SELL:
      CurrentView = (
        <Sell onSwapArrowClick={() => setView(DAppView.BUY)} small />
      );
      break;
    case DAppView.DEVOTION:
      CurrentView = <Devotion />;
      break;
    case DAppView.UNLOCK:
      CurrentView = <Unlock />;
      break;
    case DAppView.PROFILE:
      CurrentView = <Profile />;
      break;
  }

  return small ? (
    <MobileContainer>
      {menuVisible && (
        <Nav ref={menuRef} small onClose={() => setMenuVisible(false)} />
      )}
      <MenuBar>
        <MenuImage onClick={() => setMenuVisible(true)} />
        <h4>TempleDAO</h4>
      </MenuBar>
      <Main>{CurrentView}</Main>
    </MobileContainer>
  ) : (
    <Container>
      <Nav />
      <Main>{CurrentView}</Main>
    </Container>
  );
};
