import { ItemInventory, RelicEnclave } from 'providers/types';
import { Navigate } from 'react-router-dom';
import styled from 'styled-components';
import MintRelicPanel from './MintRelicPanel';
import { NexusPanel } from './styles';
import Image from 'components/Image/Image';
import centerCircle from 'assets/images/nexus/central_circle.png';
import templeUniswap from 'assets/images/nexus/templeuniswap.png';
import { Button } from 'components/Button/Button';
import { useRelic } from 'providers/RelicProvider';
import { useEffect, useMemo, useState } from 'react';
import { NexusLoading } from '.';
import { useWallet } from 'providers/WalletProvider';
import { BigNumber } from 'ethers';
import { Account } from 'components/Layouts/CoreLayout/Account';
import Tooltip from 'components/Tooltip/Tooltip';
import { clickSound } from 'utils/sound';
import { fromAtto } from 'utils/bigNumber';

type NoRelicPanelProps = {
  inventory: ItemInventory;
  onSacrificeHandler: () => Promise<void>;
};

export const NoRelicPanel = ({ inventory, onSacrificeHandler }: NoRelicPanelProps) => {
  const { relics } = inventory;
  const { wallet, walletAddress, signer, isConnected } = useWallet();

  const { fetchSacrificePrice } = useRelic();

  const {
    error: fetchSacrificePriceError,
    handler: fetchSacrificePriceHandler,
    isLoading: sacrificePriceLoading,
    sacrificePrice,
  } = fetchSacrificePrice;

  useEffect(() => {
    if (signer && walletAddress) {
      fetchSacrificePriceHandler();
    }
  }, [fetchSacrificePriceHandler, signer, walletAddress]);

  const [showConnect, setShowConnect] = useState(true);

  useEffect(() => {
    if (isConnected && wallet) {
      setShowConnect(false);
    } else {
      setShowConnect(true);
    }
  }, [wallet, isConnected]);

  if (relics.length > 0) {
    return <Navigate to={`../${relics[0].id.toString()}`} />;
  }

  return (
    <>
      {showConnect ? (
        <ConnectWalletContainer>
          <ConnectWalletText>Connect Wallet to Continue</ConnectWalletText>
          <ConnectButtonWrapper>
            <Account />
          </ConnectButtonWrapper>
        </ConnectWalletContainer>
      ) : (
        <>
          {sacrificePriceLoading && <NexusLoading />}
          {!sacrificePriceLoading && <SacrificePanel amount={sacrificePrice} onSacrificeHandler={onSacrificeHandler} />}
          {fetchSacrificePriceError && <div>Error while checking sacrifice price!</div>}
        </>
      )}
    </>
  );
};

type SacrificeUIProps = {
  amount: BigNumber;
  onSacrificeHandler?: () => Promise<void>;
};

const TooltipContent = styled.div`
  * {
    color: ${({ theme }) => theme.palette.brandLight};
  }
  p {
    font-size: ${({ theme }) => theme.typography.meta};
  }
`;

const tooltipContent = (
  <TooltipContent>
    <>
      <p>
        If you do not yet have Arbitrum TEMPLE, you may bridge them from Ethereum, or acquire them on Arbitrum by
        clicking on the Uniswap button below.
      </p>
    </>
  </TooltipContent>
);

const SacrificePanel = (props: SacrificeUIProps) => {
  const { amount, onSacrificeHandler } = props;

  const { sacrificeTemple } = useRelic();

  const [enclaveSelected, setEnclaveSelected] = useState(false);
  const [selectedEnclave, setSelectedEnclave] = useState<RelicEnclave>();

  return (
    <NexusPanel>
      <SacrificePanelRow>Are you worthy...?</SacrificePanelRow>
      {/* <Image width={300} src={centerCircle}></Image> */}
      <h3>{'Welcome, Seekers.'}</h3>
      <PriceRow>
        {'To prove yourself worthy to enter the Nexus, you must sacrifice some TEMPLE'}
        <Tooltip inline content={tooltipContent}>
          &nbsp; ⓘ
        </Tooltip>
        <MintYourFirstRelicText>{'and mint your first Relic'}</MintYourFirstRelicText>
      </PriceRow>
      <SectionHeading>{'1. Select your Enclave'}</SectionHeading>
      <MintRelicContainer>
        <MintRelicPanel
          onSelectEnclave={(enclave) => {
            setEnclaveSelected(true);
            setSelectedEnclave(enclave);
          }}
        />
      </MintRelicContainer>
      <SectionHeading>{'2. Sacrifice Temple to Mint a Relic'}</SectionHeading>

      <a
        href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x6d2caf65163ff290ec2a362d6e413fae4643f90e"
        target="_new"
        onClick={() => {
          clickSound.play();
        }}
      >
        {' '}
        <GetTempleButton disabled={!enclaveSelected} playClickSound>
          <UniswapImage src={templeUniswap} width={30} /> Get Temple
        </GetTempleButton>
      </a>

      <SacrificeButton
        disabled={!enclaveSelected}
        playClickSound
        label={`Sacrifice ${fromAtto(amount).toFixed(2)} TEMPLE`}
        loading={sacrificeTemple.isLoading}
        onClick={async () => {
          await sacrificeTemple.handler(amount, selectedEnclave!);
          if (onSacrificeHandler) {
            await onSacrificeHandler();
          }
        }}
      />
    </NexusPanel>
  );
};

const SectionHeading = styled.div`
  font-size: 1.5rem;
  font-family: Megant, serif;
  color: ${({ theme }) => theme.palette.brandDark};
`;

const MintRelicContainer = styled.div`
  // border: 2px none ${({ theme }) => theme.palette.brandDark};
  // border-radius: 5px;
  width: 100%;
`;

const MintYourFirstRelicText = styled.div`
  // font-size: 1.25rem;
`;

const UniswapImage = styled(Image)`
  vertical-align: bottom;
`;

const ConnectWalletText = styled.div`
  font-size: 1.75rem;
  margin: auto;
  color: ${({ theme }) => theme.palette.brandLight};
  padding-bottom: 20px;
`;

const ConnectButtonWrapper = styled.div`
  width: 200px;
  margin: auto;
`;

const ConnectWalletContainer = styled.div`
  margin: auto;
  display: flex;
  flex-direction: column;
`;

const PriceRow = styled.div`
  margin: auto;
  text-align: center;
  padding-bottom: 10px;
  font-family: Megant, serif;
  color: #bd7b4f;
  font-size: 18px;
`;

const SacrificePanelRow = styled.h3`
  margin: auto;
  padding-bottom: 10px;
`;

const GetTempleButton = styled(Button)`
  width: 300px;
  margin-top: 1rem;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 2px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  // text-shadow: 0 0 20px #fff;
  padding-bottom: 4px;
`;

const SacrificeButton = styled(Button)`
  width: 300px;
  margin-top: 1rem;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 2px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  // text-shadow: 0 0 20px #fff;
`;

export default MintRelicPanel;
