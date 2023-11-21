import styled from 'styled-components';
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';

import Image from '../../../Image/Image';
import WalletLogo from 'assets/icons/account_balance_wallet.svg?react';
import temple_dao_logo from 'assets/images/sun-art.svg';
import TruncatedAddress from 'components/TruncatedAddress';

import Loader from 'components/Loader/Loader';
import { Link } from 'react-router-dom';
import { tabletAndAbove } from 'styles/breakpoints';
import { MAINNET_CHAIN, SEPOLIA_CHAIN } from 'utils/envChainMapping';
import { theme } from 'styles/theme';
import { transparentize } from 'polished';
import { MenuNavItem, MenuNavItems } from '..';
import { useGeoBlocked } from 'hooks/use-geo-blocked';

type NavLinksProps = {
  menuNavItems: MenuNavItems;
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
  isNavCollapsed?: boolean;
  onClickHandler?: () => void;
};

const NavLinks = (props: NavLinksProps) => {
  const { menuNavItems, onSelectMenuNavItems, isNavCollapsed = false, onClickHandler } = props;
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
  const { walletAddress } = useWallet();
  const { isBlocked } = useGeoBlocked();

  const [{ connectedChain }] = useSetChain();
  const currentChainId = parseInt(connectedChain?.id || '', 16);

  const onMenuClick = async(mi: MenuNavItem) =>{
    await onSelectMenuNavItems(mi);
    if (onClickHandler) onClickHandler();
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

  const explorerUrl = getChainExplorerURL(walletAddress || '', currentChainId);

  const connectWallet = async () => {
    // TODO: What to do in this case?
    if (isBlocked) return alert('Restricted Jurisdiction');
    if(onClickHandler) onClickHandler();
    connect();
  };
  const disconnectWallet = async () => {
    if (!wallet) return;
    if(onClickHandler) onClickHandler();
    disconnect(wallet);
  };

  return (
    <>
      <TempleLink to="/">
        <TempleLogo src={temple_dao_logo} />
      </TempleLink>
      {menuNavItems.map((mi) => (
        <NavLink key={mi.label} light={mi.selected} to={mi.linkTo} onClick={() => onMenuClick(mi)}>
          <NavLinkCell light={mi.selected}>
            <mi.Logo id={mi.label} fill={mi.selected ? theme.palette.brandLight : theme.palette.brand} />
            {!isNavCollapsed && <NavLinkText light={mi.selected}>{mi.label}</NavLinkText>}
          </NavLinkCell>
        </NavLink>
      ))}
      <Separator />
      <div>
        {/* // TODO: We also need an "Off" or disconnected version of this button */}
        {connecting && <Loader iconSize={24} />}
        {!connecting && !isBlocked && (
          <>
            {wallet ? (
              <WalletContainer>
                <Wallet onClick={disconnectWallet} />
                {!isNavCollapsed && (
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
                    {
                      <NavLinkText>
                        <TruncatedAddress address={walletAddress || ''} />
                      </NavLinkText>
                    }
                  </UserAddress>
                )}
              </WalletContainer>
            ) : (
              <WalletContainer onClick={connectWallet}>
                <Wallet fill={theme.palette.light} />
                {!isNavCollapsed && (
                  <NavLinkText light style={{ cursor: 'pointer' }}>
                    Connect
                  </NavLinkText>
                )}
              </WalletContainer>
            )}
          </>
        )}
        {isBlocked && (
          <>
            <Wallet fill={theme.palette.grayOpaque} />
            {!isNavCollapsed && <NavLinkText small>Blocked</NavLinkText>}
          </>
        )}
      </div>
    </>
  );
};

export default NavLinks;

const UserAddress = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.75rem;
  font-weight: 300;
`;

const TempleLogo = styled(Image)`
  width: 40px;
  margin-left: 5px;
  ${tabletAndAbove(`
    margin-bottom: 40px;
    margin-top: 5px;
    align-self: center;
  `)};
`;

const TempleLink = styled(Link)`
  padding: 1rem;
  width: 40px;
`;

const Wallet = styled(WalletLogo)`
  cursor: pointer;
  vertical-align: middle;
  min-width: 24px;
  fill: ${({ fill, theme }) => fill ?? theme.palette.brand};
  stroke: ${({ stroke, theme }) => stroke ?? theme.palette.brand50};
  &:hover {
    stroke: ${({ fill, theme }) => (fill ? transparentize(0.75, fill) : theme.palette.brand75)};
  }
`;

const Separator = styled.hr`
  margin: 10px 0;
  position: relative;
  border: 0;
  width: 100%;
  border-top: 1px solid ${(props) => props.theme.palette.brand}};
`;

type NavLinkProps = {
  small?: boolean;
  light?: boolean;
};

const NavLinkText = styled.span<NavLinkProps>`
  margin-left: 0.5rem;
  font-weight: 700;
  color: ${({ theme, light }) => (light ? theme.palette.brandLight : theme.palette.brand)};
  vertical-align: middle;
  &:hover {
    text-decoration: underline;
  }
  font-size: ${(props) => (props.small ? '0.75rem' : '1rem')};
`;

const NavLinkCell = styled.div<NavLinkProps>`
  display: flex;
  align-items: center;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 5px;
  fill: ${({ light, theme }) => (light ? theme.palette.brandLight : 'current')}
  &:hover {
    background-color: ${(props) => props.theme.palette.brand25};
  }
  ${tabletAndAbove(`
    padding: 10px;
  `)}
`;

const NavLink = styled(Link)<NavLinkProps>`
  display: flex;
  height: 4rem;
  padding: 1rem;
  align-items: center;
  flex-direction: row;
  background: ${({light, theme}) => light ? theme.palette.gradients.greyVertical : 'none'};
  &:hover {
    text-decoration: underline;
  }
`;

const WalletContainer = styled.div`
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  padding: 1rem;
  padding-left: 1.5rem;
`;
