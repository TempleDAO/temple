import React, { FC, useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import styled from 'styled-components';
import { useRefreshWalletState } from 'hooks/use-refresh-wallet-state';
import MetamaskButton from 'components/Button/MetamaskButton';
import DevotionCTA from 'components/Accessories/DevotionCTA';
import { DApp } from 'components/DApp/DApp';
import { Analytics } from 'components/DApp/Analytics';
import { NavContext } from 'components/DApp/NavContext';
import { DAppView } from 'enums/dapp-view';
import BgImage from 'assets/images/dapp-bg.svg';

interface SizeProps {
  small?: boolean;
}

const DAppRoot = () => {
  const isSmallOrMediumScreen = useMediaQuery({ query: '(max-width: 800px)' });
  const [activeView, setView] = useState(DAppView.BUY);
  const navContext = { activeView, setView };
  const refreshWalletState = useRefreshWalletState();

  useEffect(() => {
    refreshWalletState();
  }, []);

  return (
    <NavContext.Provider value={navContext}>
      {isSmallOrMediumScreen ? <DAppSmall /> : <DAppLarge />}
    </NavContext.Provider>
  );
};

const DAppLarge = () => (
  <Background>
    <DevotionCTA />
    <MetamaskButton />
    <Container>
      <DApp />
      <Analytics />
    </Container>
  </Background>
);

const DAppSmall: FC = () => (
  <Frame>
    <Container small>
      <MetamaskButtonFrame>
        <MetamaskButton />
      </MetamaskButtonFrame>
      <DApp small />
    </Container>
  </Frame>
);

export default DAppRoot;

const Background = styled.div`
  height: 100vh;
  width: 100vw;

  background-image: url(${BgImage});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;

  position: relative;
  display: flex;
  justify-content: center;
`;

const Container = styled.div<SizeProps>`
  // border: 1px solid red;
  margin-top: ${({ small }) => (small ? '0px' : '5%')};
  display: flex;
  flex-wrap: wrap;
  width: ${({ small }) => (small ? '100%' : '50rem')};
  background-color: ${(props) => props.theme.palette.dark};
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  height: fit-content;
  outline: 20px solid black;
`;

const Frame = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  width: 100vw;
`;

const MetamaskButtonFrame = styled.div`
  position: absolute:
  top: 0;
  right: 0;

  div {
    padding: 0;
    padding-top: 0.3125rem /* 5/16 */;
  }
`;
