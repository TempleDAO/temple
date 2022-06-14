import styled from 'styled-components';
import { useAccount, useConnect, useNetwork, useDisconnect, useEnsName } from 'wagmi';

import TruncatedAddress from 'components/TruncatedAddress';
import Loader from 'components/Loader/Loader';
import { Button as BaseButton } from 'components/Button/Button';
import { LOCAL_CHAIN } from 'components/WagmiProvider';
import { usePopoverContext, PopoverName } from 'providers/PopoverProvider';

import Tooltip from 'components/Tooltip/Tooltip';

export const Account = () => {
  const { openPopover } = usePopoverContext();
  const { activeChain, isLoading: networkLoading } = useNetwork();
  const { activeConnector: connector, isConnecting: connectLoading } = useConnect();
  const { data: accountData, isLoading: accountLoading } = useAccount();
  const { disconnect } = useDisconnect();

  const isLocalChain = activeChain?.id === LOCAL_CHAIN.id;
  const { data: ensName } = useEnsName({
    address: !isLocalChain && accountData?.address || undefined
  });

  if (accountLoading || connectLoading || networkLoading) {
    return <Loader />;
  }

  if (accountData?.address) {
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
    
    const ensOrAddress = ensName || accountData.address;
    const explorerUrl = getChainExplorerURL(ensOrAddress, activeChain?.id);
   
    return (
      <>
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
          {ensName || <TruncatedAddress address={accountData.address} />}
        </UserAddress>
        {!isMetaMask ? disconnectButton : (
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
      label={"Connect Wallet"}
      role="button"
      onClick={() => {
        openPopover(PopoverName.Connect);
      }}
    />
  );
}

const getChainExplorerURL = (ensOrAddress: string, chainId?: number) => {
  switch (chainId) {
    case 1: return `https://etherscan.io/address/${ensOrAddress}`;
    case 4: return `https://rinkeby.etherscan.io/${ensOrAddress}`;
    default: return '#';
  }
};

const ConnectButton = styled(BaseButton)`
  background-color: rgba(0, 0, 0, 0);
  border-radius: .75rem;
  font-weight: 400;
  border: transparent; 
  color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  margin: 0 0 0 0.75rem;
  font-size: .75rem;
  letter-spacing: 0.1em;
  transition: background .2s ease-in-out;

  &:hover {
    background-color: rgba(0, 0, 0, 0.25);
  }

  &:disabled {
    border: 1px solid #bd7b4f80;
  }
`;

const UserAddress = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.75rem;
  font-weight: 300;
`;