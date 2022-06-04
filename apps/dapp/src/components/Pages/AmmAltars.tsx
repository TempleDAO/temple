import React, { ReactNode, useEffect, useState } from 'react';
import styled, { css } from 'styled-components';

import { Buy } from 'components/AMM/Buy';
import Devotion from 'components/AMM/Devotion';
import { Queue } from 'components/AMM/Queue';
import { Sell } from 'components/AMM/Sell';
import { Stake } from 'components/AMM/Stake';
import { Unlock } from 'components/AMM/Unlock';
import { Withdraw } from 'components/AMM/Withdraw';
import Image from 'components/Image/Image';
import withWallet from 'hoc/withWallet';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';

import EnterBgImage from 'assets/images/altar-enter-bg.jpg';
import ExitBgImage from 'assets/images/altar-exit.jpg';
import crossImage from 'assets/images/cross.svg';
import DevotionBgImage from 'assets/images/devotion_bg.jpg';

const ENV_VARS = import.meta.env;

export enum AMMView {
  BUY = 'BUY',
  STAKE = 'STAKE',

  // MINT = 'MINT', //added by 0xcandle
  // EQUIP = 'EQUIP',

  UNLOCK = 'UNLOCK',
  JOIN_QUEUE = 'JOIN_QUEUE',
  WITHDRAW_TEMPLE = 'WITHDRAW_TEMPLE',
  SELL = 'SELL',
  DEVOTION = 'DEVOTION',

  EXCHANGE_TRADE = 'TRADE',
  EXCHANGE_DEFEND = 'DEFEND',
  EXCHANGE_WITHDRAW = 'WITHDRAW',
}


// CustomRoutingPage does not take view as prop
const AMMAltars = ({ routingHelper, view }: CustomRoutingPageProps & { view: AMMView }) => {
  const { back } = routingHelper;
  const [activeAMMView, setActiveAMMView] = useState<AMMView | null>(view);

  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (e.key === 'Escape') back();
    }

    window.addEventListener('keyup', onKeyup);
    return () => window.removeEventListener('keyup', onKeyup);
  }, [back]);

  const renderAMMView = (): ReactNode => {
    console.log('rendering amm view');
    switch (activeAMMView) {
      case AMMView.BUY:
        return <Buy onSwapArrowClick={() => setActiveAMMView(AMMView.SELL)} />;
      case AMMView.SELL:
        return <Sell onSwapArrowClick={() => setActiveAMMView(AMMView.BUY)} />;
      case AMMView.STAKE:
        return <Stake />;
      case AMMView.UNLOCK:
        return (
          <Unlock
          // if decided otherwise, we can bring these back
          // onReturnClick={back}
          // onExitClick={() => setActiveAMMView(AMMView.JOIN_QUEUE)}
          />
        );
      case AMMView.JOIN_QUEUE:
        return <Queue />;
      case AMMView.WITHDRAW_TEMPLE:
        return <Withdraw />;
      case AMMView.DEVOTION:
        return ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ENGAGED ? (
          <Devotion />
        ) : (
          <h4>The Altar room is quiet for now. You feel a sense of peace.</h4>
        );
      default:
        return null;
    }
  };

  const getBackgroundImage = () => {
    let bgImage = '';
    if (activeAMMView === AMMView.BUY || activeAMMView === AMMView.STAKE) {
      bgImage = EnterBgImage;
    }
    if (
      activeAMMView === AMMView.UNLOCK ||
      activeAMMView === AMMView.JOIN_QUEUE ||
      activeAMMView === AMMView.WITHDRAW_TEMPLE ||
      activeAMMView === AMMView.SELL
    ) {
      bgImage = ExitBgImage;
    }
    if (activeAMMView === AMMView.DEVOTION) {
      bgImage = DevotionBgImage;
    }

    return bgImage;
  };

  return (
    <>
      <Background backgroundUrl={() => getBackgroundImage()}>
        <ConvoFlowContent
          isSmall={
            activeAMMView === AMMView.BUY ||
            activeAMMView === AMMView.STAKE ||
            activeAMMView === AMMView.SELL
          }
          isDisabled={
            ENV_VARS.VITE_PUBLIC_AMM_STOPPED === 'true' &&
            (activeAMMView === AMMView.BUY || activeAMMView === AMMView.SELL)
          }
        >
          <ConvoFlowClose
            src={crossImage}
            alt={'Close notification'}
            width={24}
            height={24}
            onClick={back}
          />
          <div style={{backgroundColor: "blue"}}>
          {renderAMMView()}
          </div>
        </ConvoFlowContent>
        <OffClickOverlay
          onClick={(e) => {
            if (activeAMMView) {
              e.preventDefault();
              e.stopPropagation();
              back();
            }
          }}
        />
      </Background>
    </>
  );
};

interface BackgroundProps {
  backgroundUrl(): string;
}

const Background = styled.div<BackgroundProps>`
  height: 100vh;
  width: 100vw;
  background-image: url(${(props) => props.backgroundUrl});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OffClickOverlay = styled.div`
  position: absolute;
  height: 100vh;
  width: 100vw;
  z-index: 0;
  transition: background 300ms;
  background-color: ${(props) => props.theme.palette.dark75};
  opacity: 0.75;
`;

interface ConvoFlowContentProps {
  isSmall?: boolean;
  isDisabled?: boolean;
}

const ConvoFlowContent = styled.div<ConvoFlowContentProps>`
  position: relative;
  z-index: ${(props) => props.theme.zIndexes.max};
  width: 100%;
  max-width: 48.75rem /* 780/16 */;
  display: flex;
  flex-direction: column;
  align-items: center;

  ${(props) =>
    props.isSmall &&
    css`
      max-width: 35rem /* 485/16 */;
    `}

  ${(props) =>
    props.isDisabled &&
    css`
      filter: grayscale(1);
      pointer-events: none;
      cursor: not-allowed;
    `}

  background-color: ${(props) => props.theme.palette.dark};
  padding: 2rem;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
`;

const ConvoFlowClose = styled(Image)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  cursor: pointer;
`;

export default withWallet(AMMAltars);
