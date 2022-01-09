import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Buy } from 'components/AMM/Buy';
import { Queue } from 'components/AMM/Queue';
import { Sell } from 'components/AMM/Sell';
import { Stake } from 'components/AMM/Stake';
import { Withdraw } from 'components/AMM/Withdraw';
import { NavContext } from 'components/DApp/NavContext';
import { Nav } from 'components/DApp/Nav';
import { DAppView } from 'enums/dapp-view';
import {
  Container,
  Main,
  MenuBar,
  MenuImage,
  MobileContainer,
} from 'components/DApp/NavComponents';

interface DAppProps {
  small?: boolean;
}

export const DApp: FC<DAppProps> = ({ small }) => {
  const ref = useRef();
  const { activeView, setView } = useContext(NavContext);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    const checkIfClickedOutside = (e) => {
      if (menuVisible && ref.current && !ref.current.contains(e.target)) {
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
  }

  return small ? (
    <MobileContainer ref={ref}>
      {menuVisible && <Nav small onClose={() => setMenuVisible(false)} />}
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
