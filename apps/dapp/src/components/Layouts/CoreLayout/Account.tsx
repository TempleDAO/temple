import styled from 'styled-components';
import { useAccount, useConnect, useNetwork, useDisconnect, useEnsName } from 'wagmi';
import { useMediaQuery } from 'react-responsive';
import TruncatedAddress from 'components/TruncatedAddress';
import Loader from 'components/Loader/Loader';
import { Button as BaseButton } from 'components/Button/Button';
import { LOCAL_CHAIN } from 'components/WagmiProvider';
import { useAppContext } from 'providers/AppProvider';
import { queryVerySmallDesktop, verySmallDesktop } from 'styles/breakpoints';

import Tooltip from 'components/Tooltip/Tooltip';
import { useEffect, useState } from 'react';

export const Account = () => {
  const { showConnectPopover } = useAppContext();
  const { chain: activeChain } = useNetwork();
  const { isLoading: connectLoading } = useConnect();
  const { address, isConnecting: accountLoading, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const isSmallDesktop = useMediaQuery({
    query: queryVerySmallDesktop,
  });
  const networkLoading = false;
  const isLocalChain = activeChain?.id === LOCAL_CHAIN.id;
  const { data: ensName } = useEnsName({
    address: (!isLocalChain && address) || undefined,
  });
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const checkBlocked = async () => {
      const blocked = await fetch(`${window.location.href}api/geoblock`)
        .then((res) => res.json())
        .then((res) => res.blocked);
      setIsBlocked(blocked);
    };
    checkBlocked();
  }, []);

  if (accountLoading || connectLoading || networkLoading) {
    return <Loader />;
  }

  if (isBlocked) {
    return <ConnectButton disabled label="Restricted Jurisdiction" isSmall isActive isUppercase role="button" />;
  }

  if (address) {
    const isMetaMask = connector?.name === 'MetaMask';
    const disconnectButton = (
      <ConnectButton
        isSmall
        isActive
        isUppercase
        disabled={isMetaMask}
        role="button"
        label="Disconnect"
        onClick={() => {
          disconnect();
        }}
      />
    );

    const ensOrAddress = ensName || address;
    const explorerUrl = getChainExplorerURL(ensOrAddress, activeChain?.id);

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
            Connected: {ensName || <TruncatedAddress address={address} />}
          </UserAddress>
        )}
        <Spacer />
        {!isMetaMask ? (
          disconnectButton
        ) : (
          <Tooltip
            content={
              'To disconnect an account managed through Metamask, ' +
              'use the “Disconnect this account” button on Metamask itself'
            }
          >
            {disconnectButton}
          </Tooltip>
        )}
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
      onClick={() => showConnectPopover()}
    />
  );
};

const getChainExplorerURL = (ensOrAddress: string, chainId?: number) => {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/address/${ensOrAddress}`;
    case 4:
      return `https://rinkeby.etherscan.io/address/${ensOrAddress}`;
    case 5:
      return `https://goerli.etherscan.io/address/${ensOrAddress}`;
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
