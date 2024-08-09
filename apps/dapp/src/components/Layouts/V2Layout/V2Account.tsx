import styled from 'styled-components';

import { useMediaQuery } from 'react-responsive';
import TruncatedAddress from 'components/TruncatedAddress';
import Loader from 'components/Loader/Loader';
import { Button as BaseButton } from 'components/Button/Button';
import { queryVerySmallDesktop, verySmallDesktop } from 'styles/breakpoints';

import { useConnectWallet, useSetChain } from '@web3-onboard/react';

import { useMemo } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { MAINNET_CHAIN, SEPOLIA_CHAIN } from 'utils/envChainMapping';

export const V2Account = () => {
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
  const { walletAddress } = useWallet();
  const [{ connectedChain }] = useSetChain();
  const currentChainId = useMemo(
    () => parseInt(connectedChain?.id || '', 16),
    [connectedChain]
  );

  const isSmallDesktop = useMediaQuery({
    query: queryVerySmallDesktop,
  });

  if (connecting) {
    return <Loader />;
  }

  if (wallet) {
    const disconnectButton = (
      <ConnectButton
        isSmall
        isActive
        isUppercase
        role="button"
        label="Disconnect"
        onClick={() => {
          disconnect(wallet);
        }}
      />
    );

    const explorerUrl = getChainExplorerURL(
      walletAddress || '',
      currentChainId
    );

    return (
      <>
        {!isSmallDesktop && (
          <UserAddress
            target="_blank"
            rel="noreferrer noopener"
            href={explorerUrl}
            onClick={(e) => {
              if (explorerUrl === '#') {
                e.preventDefault();
              }
            }}
          >
            Connected: {<TruncatedAddress address={walletAddress || ''} />}
          </UserAddress>
        )}
        <Spacer />
        {disconnectButton}
      </>
    );
  }

  return (
    <ConnectButton
      isSmall
      isActive
      isUppercase
      label={'Connect Wallet'}
      role="button"
      disabled={connecting}
      onClick={() => {
        wallet ? disconnect(wallet) : connect();
      }}
    />
  );
};

const getChainExplorerURL = (ensOrAddress: string, chainId?: number) => {
  switch (chainId) {
    case MAINNET_CHAIN.id:
      return `https://etherscan.io/address/${ensOrAddress}`;
    case SEPOLIA_CHAIN.id:
      return `https://sepolia.etherscan.io/address/${ensOrAddress}`;
    default:
      return '#';
  }
};

const Spacer = styled.div`
  height: 10px;
`;

const ConnectButton = styled(BaseButton)`
  background-color: rgba(0, 0, 0, 0);
  border-radius: 0.75rem;
  font-weight: 400;
  border: transparent;
  color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};

  font-size: 0.75rem;
  letter-spacing: 0.1em;
  transition: background 0.2s ease-in-out;

  &:hover {
    background-color: rgba(0, 0, 0, 0.25);
  }

  &:disabled {
    border: 1px solid #bd7b4f80;
  }

  ${verySmallDesktop(`
    padding: 0 0.5rem;
  `)}
`;

const UserAddress = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.75rem;
  font-weight: 300;
`;
