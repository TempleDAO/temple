import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { transparentize } from 'polished';

import dropdownIcon from 'assets/icons/dropdown.svg?react';
import walletIcon from 'assets/icons/account_balance_wallet.svg?react';
import LinkIcon from 'assets/icons/link.svg?react';
import DisconnectIcon from 'assets/icons/disconnect.svg?react';

import { MAINNET_CHAIN, SEPOLIA_CHAIN } from 'utils/envChainMapping';

import Loader from 'components/Loader/Loader';
import { useState } from 'react';
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';
import TruncatedAddress from 'components/TruncatedAddress';

type WalletNavProps = {
  isNavCollapsed: boolean;
  onClickHandler?: () => void;
};

export const WalletNav = (props: WalletNavProps) => {
  const { isNavCollapsed, onClickHandler } = props;
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
  const { walletAddress } = useWallet();

  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [{ connectedChain }] = useSetChain();

  const currentChainId = parseInt(connectedChain?.id || '', 16);
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

  const explorerUrl = getChainExplorerURL(walletAddress || '', currentChainId);

  const connectWallet = async () => {
    if (onClickHandler) onClickHandler();
    await connect();
  };
  const disconnectWallet = async () => {
    if (!wallet) return;
    await disconnect(wallet);
    if (onClickHandler) onClickHandler();
  };

  return (
    <WalletContainer onMouseLeave={() => setIsWalletDropdownOpen(false)}>
      {connecting && <Loader iconSize={24} />}
      {!connecting && wallet ? (
        <FlexColumnContainer>
          <WalletConnectedContainer
            onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
          >
            <WalletIcon />
            {!isNavCollapsed && (
              <>
                <UserAddress>
                  <TruncatedAddress address={walletAddress || ''} />
                </UserAddress>
                {isWalletDropdownOpen ? <ArrowUp /> : <ArrowDown />}
              </>
            )}
          </WalletConnectedContainer>
          {isWalletDropdownOpen && (
            <WalletDropdownContainer>
              <DropdownLabel
                borderBottom
                onClick={() =>
                  window.open(explorerUrl, '_blank', 'noreferrer noopener')
                }
              >
                Wallet
                <LinkIcon fill={theme.palette.brand} height={16} width={16} />
              </DropdownLabel>
              <DropdownLabel onClick={disconnectWallet}>
                Disconnect
                <DisconnectIcon
                  fill={theme.palette.brand}
                  height={16}
                  width={16}
                />
              </DropdownLabel>
            </WalletDropdownContainer>
          )}
        </FlexColumnContainer>
      ) : (
        <div onClick={connectWallet}>
          <WalletIcon fill={theme.palette.light} />
          {!isNavCollapsed && (
            <NavLinkText style={{ cursor: 'pointer' }}>Connect</NavLinkText>
          )}
        </div>
      )}
    </WalletContainer>
  );
};

const ArrowDown = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
`;

const ArrowUp = styled(dropdownIcon)`
  fill: ${({ theme }) => theme.palette.brand};
  transform: rotate(180deg);
`;

const WalletDropdownContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: ${({ theme }) => theme.palette.brand};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 5px;
  margin-top: 16px;
`;

const DropdownLabel = styled.label<{ borderBottom?: boolean }>`
  display: flex;
  padding: 10px;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  align-items: center;
  align-self: stretch;
  ${({ theme, borderBottom }) =>
    borderBottom && `border-bottom: 1px solid ${theme.palette.brand}`};
  cursor: pointer;
  background: ${({ theme }) => theme.palette.black};
  &:hover {
    background: ${({ theme }) => theme.palette.gradients.greyVertical};
  }
`;

const FlexColumnContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const WalletConnectedContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const WalletContainer = styled.div`
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  align-items: center;
  padding: 16px 40px 16px 30px;
  cursor: pointer;
  ${breakpoints.minTablet(`
    padding-left: 25px;
  `)}
`;

const WalletIcon = styled(walletIcon)`
  cursor: pointer;
  vertical-align: middle;
  min-width: 24px;
  fill: ${({ fill, theme }) => fill ?? theme.palette.brand};
  stroke: ${({ stroke, theme }) => stroke ?? theme.palette.brand50};
  &:hover {
    stroke: ${({ fill, theme }) =>
      fill ? transparentize(0.75, fill) : theme.palette.brand75};
  }
`;

type NavLinkProps = {
  small?: boolean;
  lightcolor?: boolean;
};

const NavLinkText = styled.span<NavLinkProps>`
  margin-left: 0.5rem;
  font-weight: 700;
  color: ${({ theme, lightcolor }) =>
    lightcolor ? theme.palette.brandLight : theme.palette.brand};
  vertical-align: middle;
  &:hover {
    text-decoration: underline;
  }
  font-size: ${(props) => (props.small ? '0.75rem' : '1rem')};
`;

const UserAddress = styled.span<NavLinkProps>`
  font-weight: 700;
  color: ${({ theme, lightcolor }) =>
    lightcolor ? theme.palette.brandLight : theme.palette.brand};
  vertical-align: middle;
  font-size: ${(props) => (props.small ? '0.75rem' : '1rem')};
`;
