import React, { ReactNode, useEffect, useState } from 'react';
import styled, { css } from 'styled-components';

import { Mint } from 'components/AMM/Mint';
import { Equip } from 'components/Nexus-FE/Equip';
import Image from 'components/Image/Image';
import withWallet from 'hoc/withWallet';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
import { Button } from 'components/Button/Button';
import { useWallet, WalletProvider } from 'providers/WalletProvider';
import EnterBgImage from 'assets/images/altar-enter-bg.jpg';
import ExitBgImage from 'assets/images/altar-exit.jpg';
import crossImage from 'assets/images/cross.svg';
import DevotionBgImage from 'assets/images/devotion_bg.jpg';

const ENV_VARS = import.meta.env;

export enum RelicView {
  

  MINT = 'MINT',
  EQUIP = 'EQUIP',

  
}


// CustomRoutingPage does not take view as prop
const RelicAltars = ({ routingHelper, view }: CustomRoutingPageProps & { view: RelicView }) => {
  const { back } = routingHelper;
  const [activeRelicView, setActiveRelicView] = useState<RelicView | null>(view);
  const { network, wallet, signer } = useWallet();

  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (e.key === 'Escape') back();
    }

    window.addEventListener('keyup', onKeyup);
    return () => window.removeEventListener('keyup', onKeyup);
  }, [back]);

  const switchToArbitrum = () => {
    if (window.ethereum) {
      window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x66eeb",
          rpcUrls: ["https://rinkeby.arbitrum.io/rpc"],
          chainName: "Arbitrum Testnet",
          nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18
          },
          blockExplorerUrls: ["https://rinkeby-explorer.arbitrum.io/#/"]
        }]
      });
    }
  }

  const renderRelicView = (): ReactNode => {
    console.log('rendering relic view');
    switch (activeRelicView) {
      case RelicView.MINT:
        return <Mint />;
      case RelicView.EQUIP:
        return <Equip />
      default:
        return null;
    }
  };

  const getBackgroundImage = () => {
    let bgImage = '';
    if (activeRelicView === RelicView.MINT || activeRelicView === RelicView.EQUIP) {
      bgImage = EnterBgImage;
    }

    return bgImage;
  };

  network?.chainId

  return (
    <>
      <Background backgroundUrl={() => getBackgroundImage()}>
        <ConvoFlowContent>
        <div style={{margin: "auto"}}>
          {network?.chainId === 421611 ? renderRelicView() : <Button
                label={'switch network to arbitrum'}
                isUppercase
                onClick={() => {switchToArbitrum();
                }}>
            </Button>}
        </div>
        </ConvoFlowContent>
        <OffClickOverlay
          onClick={(e) => {
            if (activeRelicView) {
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

const ConvoFlowContent = styled.div<ConvoFlowContentProps>`
  position: relative;
  z-index: ${(props) => props.theme.zIndexes.max};
  width: 50%;
  max-width: 48.75rem /* 780/16 */;
  display: flex;
  flex-direction: row;
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


//old css below

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

const ConvoFlowClose = styled(Image)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  cursor: pointer;
`;

export default withWallet(RelicAltars);
