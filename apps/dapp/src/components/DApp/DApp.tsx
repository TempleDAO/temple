import React, { FC, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

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

interface DAppProps {
  small?: boolean;
}

export const DApp: FC<DAppProps> = ({ small }) => {
  const menuRef = useRef() as React.MutableRefObject<HTMLDivElement>;
  const navigate = useNavigate();
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

  const routes = (
    <Routes>
      <Route path="/buy" element={<Buy onSwapArrowClick={() => navigate('/dapp/sell')} small />} />
      <Route path="/stake" element={<Stake small />} />
      <Route path="/queue" element={<Queue small />} />
      <Route path="/withdraw" element={<Withdraw small />} />
      <Route path="/sell" element={<Sell onSwapArrowClick={() => navigate('/dapp/buy')} small />} />
      <Route path="/devotion" element={<Devotion />} />
      <Route path="/unlock" element={<Unlock />} />
      <Route path="/profile" element={<Profile />} />
      {/* Preserve the old /dapp route in case someone has that bookmarked */}
      <Route path="/" element={<Navigate replace to="/dapp/buy" />} />
      {/* Catch all other routes and redirect to home page */}
      <Route path="/*" element={<Navigate replace to="/" />} />
    </Routes>
  );

  return small ? (
    <MobileContainer>
      {menuVisible && (
        <Nav ref={menuRef} small onClose={() => setMenuVisible(false)} />
      )}
      <MenuBar>
        <MenuImage onClick={() => setMenuVisible(true)} />
        <h4>TempleDAO</h4>
      </MenuBar>
      <Main>{routes}</Main>
    </MobileContainer>
  ) : (
    <Container>
      <Nav />
      <Main>{routes}</Main>
    </Container>
  );
};
