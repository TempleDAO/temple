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
import { createBrowserHistory } from 'history';

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

  let history = createBrowserHistory();

  switch (activeView) {
    case DAppView.BUY:
      CurrentView = (
        <Buy onSwapArrowClick={() => setView(DAppView.SELL)} small />
      );
      history.push(`/dapp?view=${DAppView.BUY}`);
      break;
    case DAppView.STAKE:
      CurrentView = <Stake small />;
      history.push(`/dapp?view=${DAppView.STAKE}`);
      break;
    case DAppView.QUEUE:
      CurrentView = <Queue small />;
      history.push(`/dapp?view=${DAppView.QUEUE}`);
      break;
    case DAppView.WITHDRAW:
      CurrentView = <Withdraw small />;
      history.push(`/dapp?view=${DAppView.WITHDRAW}`);
      break;
    case DAppView.SELL:
      CurrentView = (
        <Sell onSwapArrowClick={() => setView(DAppView.BUY)} small />
      );
      history.push(`/dapp?view=${DAppView.SELL}`);
      break;
    case DAppView.DEVOTION:
      CurrentView = <Devotion />;
      history.push(`/dapp?view=${DAppView.DEVOTION}`);
      break;
    case DAppView.UNLOCK:
      CurrentView = <Unlock />;
      history.push(`/dapp?view=${DAppView.UNLOCK}`);
      break;
    case DAppView.PROFILE:
      CurrentView = <Profile />;
      history.push(`/dapp?view=${DAppView.PROFILE}`);
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
