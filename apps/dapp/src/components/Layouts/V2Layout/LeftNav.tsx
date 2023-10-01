import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useConnectWallet, useSetChain } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';
import { useMediaQuery } from 'react-responsive';

import Image from '../../Image/Image';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import account_balance_wallet from './assets/account_balance_wallet.png';
import currency_exchange from './assets/currency_exchange.png';
import dashboard from './assets/dashboard.png';
import payments from './assets/payments.png';
import restore from './assets/restore.png';
import temple_dao_logo from './assets/temple-dao-logo.png';
import Loader from 'components/Loader/Loader';
import TruncatedAddress from 'components/TruncatedAddress';
import { MAINNET_CHAIN, SEPOLIA_CHAIN } from 'utils/envChainMapping';

const LeftNav = () => {
  const [isNavCollapsed, setNavCollapsed] = useState(true);

  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet();
  const { walletAddress } = useWallet();
  const [{ connectedChain }] = useSetChain();
  const currentChainId = useMemo(() => parseInt(connectedChain?.id || '', 16), [connectedChain]);

  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const checkBlocked = async () => {
      const blocked = await fetch(`${window.location.href}api/geoblock`)
        .then((res) => res.json())
        .then((res) => res.blocked)
        .catch(() => false);
      setIsBlocked(blocked);
    };
    checkBlocked();
  }, []);

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

  return (
    <Nav
      collapsed={isNavCollapsed}
      onMouseEnter={() => setNavCollapsed(false)}
      onMouseLeave={() => setNavCollapsed(true)}
    >
      <NavContent collapsed={isNavCollapsed}>
        <TempleLogo src={temple_dao_logo} />
        <NavLink to="/v2dapp/dashboard">
          <NavLinkCell>
            {/* // TODO: Icon can be split into its own component */}
            <NavIcon src={dashboard} />
            {!isNavCollapsed && <NavLinkText>Dashboard</NavLinkText>}
          </NavLinkCell>
        </NavLink>
        <NavLink to="/v2dapp/trade">
          <NavLinkCell>
            <NavIcon src={currency_exchange} />
            {!isNavCollapsed && <NavLinkText>Trade</NavLinkText>}
          </NavLinkCell>
        </NavLink>
        <NavLink to="/v2dapp/borrow">
          <NavLinkCell>
            <NavIcon src={payments} />
            {!isNavCollapsed && <NavLinkText>Borrow</NavLinkText>}
          </NavLinkCell>
        </NavLink>
        <NavLink to="/v2dapp/legacy">
          <NavLinkCell>
            <NavIcon src={restore} />
            {!isNavCollapsed && <NavLinkText>Legacy</NavLinkText>}
          </NavLinkCell>
        </NavLink>
        <Separator />
        <NavLink
          to="#"
          onClick={() => {
            // TODO: What to do in this case?
            if (isBlocked) {
              return alert('Restricted Jurisdiction');
            }
            wallet ? disconnect(wallet) : connect();
          }}
        >
          <NavLinkCell>
            {/* // TODO: We also need an "Off" or disconnected version of this button */}
            {connecting && <Loader iconSize={24} />}
            {!connecting && !isBlocked && (
              <>
                {wallet ? (
                  <>
                    <NavIcon
                      src={account_balance_wallet}
                      onClick={() => {
                        disconnect(wallet);
                      }}
                    />
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
                  </>
                ) : (
                  <>
                    <NavIcon
                      src={account_balance_wallet}
                      onClick={() => {
                        connect();
                      }}
                    />
                    {!isNavCollapsed && <NavLinkText>Connect</NavLinkText>}
                  </>
                )}
              </>
            )}
            {isBlocked && (
              <>
                {/* // TODO: Maybe some other icon? */}
                <NavIcon src={account_balance_wallet} />
                {!isNavCollapsed && <NavLinkText small>Blocked</NavLinkText>}
              </>
            )}
          </NavLinkCell>
        </NavLink>
      </NavContent>
    </Nav>
  );
};

export default LeftNav;

const UserAddress = styled.a`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.75rem;
  font-weight: 300;
`;

const TempleLogo = styled(Image)`
  width: 40px;
  margin-bottom: 40px;
  align-self: center;
`;

const NavIcon = styled(Image)`
  vertical-align: middle;
  // display: inline;
`;

const Separator = styled.hr`
  margin: 10px 0;
  position: relative;
  border: 0;
  width: 100%;
  border-top: 1px solid ${(props) => props.theme.palette.brand}};
`;

type NavProps = {
  collapsed: boolean;
};

const Nav = styled.nav<NavProps>`
  background-image: url('${footerTexture}');
  transition: width 0.3s ease;
  width: ${(props) => (props.collapsed ? '70px' : '200px')};
  justify-content: center;
  display: flex;
`;

type NavContentProps = {
  collapsed: boolean;
};

const NavContent = styled.div<NavContentProps>`
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  width: 90%;
  padding-left: 8px;
  padding-right: 8px;
`;

type NavLinkProps = {
  small?: boolean;
};

const NavLinkText = styled.span<NavLinkProps>`
  margin-left: 0.5rem;
  font-weight: 700;
  color: ${(props) => props.theme.palette.brand};
  vertical-align: middle;
  &:hover {
    text-decoration: underline;
  }
  font-size: ${(props) => (props.small ? '0.75rem' : '1rem')};
`;

const NavLinkCell = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  margin-top: 1rem;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 5px;
  &:hover {
    background-color: ${(props) => props.theme.palette.brand25};
  }
`;

const NavLink = styled(Link)`
  // &:hover {
  //   text-decoration: underline;
  // }
`;
