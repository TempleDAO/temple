import { FC } from 'react';
import { Link, useResolvedPath, useMatch } from 'react-router-dom';
import styled from 'styled-components';

import { useWallet } from 'providers/WalletProvider';
import { flexCenter } from 'styles/mixins';
import { UnstyledList } from 'styles/common';

import selectorIcon from './nav-selector-icon.svg';
import templeDaoLogo from 'assets/images/sun-art.svg';
import metamaskLogo from 'assets/images/metamask-transparent.svg';

const Header = () => {
  const { connectWallet, changeWalletAddress, wallet } = useWallet();

  return (
    <Wrapper>
      <Logo />
      <nav>
        <Menu>
          <MenuItem
            to="/core"
            strictMatch
          >
            Home
          </MenuItem>
          <MenuItem to="/core/vaults">
            Vaults
          </MenuItem>
          <MenuItem to="/core/trade">
            Trade
          </MenuItem>
          <MenuItem to="/core/profile">
            Profile
          </MenuItem>
          <MenuItem to="/core/analytics">
            Analytics
          </MenuItem>
        </Menu>
      </nav>
      <MetamaskButton
        aria-label={wallet ? 'Change Wallet' : 'Connect Wallet'}
        onClick={wallet ? changeWalletAddress : connectWallet}
      />
    </Wrapper>
  );
};

export default Header;

interface MenuItemProps {
  to: string;
  strictMatch?: boolean;
}

const MenuItem: FC<MenuItemProps> = ({ to, children, strictMatch = false }) => {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: strictMatch });

  return (
    <li>
      <NavLink
        to={to}
        $active={!!match}
      >
        {children}
      </NavLink>
    </li>
  );
};

const NAV_HOVER = '#FFDEC9';
const NAV_SHADOW = '0px 0px 5px rgba(222, 92, 6, 0.5)';
const NAV_BACKGROUND_GRADIENT_START = '#0B0A0A';
const NAV_BACKGROUND_GRADIENT_END = '#1D1A1A';

const Wrapper = styled.header`
  background: linear-gradient(180deg, ${NAV_BACKGROUND_GRADIENT_START} 0%, ${NAV_BACKGROUND_GRADIENT_END} 100%);
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.75rem;
`;

const Logo = styled.span`
  display: block;
  width: 42px;
  height: 42px;
  background: url(${templeDaoLogo});
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
`;

const Menu = styled(UnstyledList)`
  display: flex;
  flex-direction: row;
  border-left: 1px solid ${({ theme }) => theme.palette.brand};
  border-right: 1px solid ${({ theme }) => theme.palette.brand};

  > li {
    border-right: 1px solid ${({ theme }) => theme.palette.brand};

    &:last-of-type {
      border-right: none;
    }
  }
`;

const MetamaskButton = styled.button`
  appearance: none;
  background: url(${metamaskLogo});
  background-position: center center;
  background-size: contain;
  background-repeat: no-repeat;
  width: 55px;
  height: 54px;
  border: none;
  cursor: pointer;
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  ${flexCenter}
  ${({ theme }) => theme.typography.fonts.fontBody}

  font-size: 1rem;
  line-height: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  min-width: 7.5rem;
  position: relative;

  padding: 26px 14px 21px;
  transition: all 150ms ease-in;

  color: ${({ theme, $active }) => $active ? NAV_HOVER : theme.palette.brand};
  text-shadow: ${({ $active }) => $active ? NAV_SHADOW : 'none'};

  &:hover {
    color: ${NAV_HOVER};
    text-shadow: ${NAV_SHADOW};
  }

  &:after {
    display: ${({ $active }) => $active ? 'block' : 'none'};
    content: '';
    background-image: url(${selectorIcon});
    background-repeat: no-repeat;
    background-position: center center;
    background-size: contain;
    width: 23px;
    height: 24px;
    position: absolute;
    bottom: 0;
    transform: translate(0, 50%);
  }
`;
