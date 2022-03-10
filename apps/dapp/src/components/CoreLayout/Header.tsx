import { FC, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Link, useResolvedPath, useMatch } from 'react-router-dom';
import styled from 'styled-components';

import { useWallet } from 'providers/WalletProvider';
import { flexCenter, buttonResets, backgroundImage } from 'styles/mixins';
import { UnstyledList } from 'styles/common';

import selectorIcon from './nav-selector-icon.svg';
import templeDaoLogo from 'assets/images/sun-art.svg';
import metamaskLogo from 'assets/images/metamask-transparent.svg';

const Header = () => {
  const { connectWallet, changeWalletAddress, wallet } = useWallet();

  return (
    <Wrapper>
      <Logo to="/core">
        TempleDAO
      </Logo>
      <Navigation />
      <MetamaskButton
        aria-label={wallet ? 'Change Wallet' : 'Connect Wallet'}
        onClick={wallet ? changeWalletAddress : connectWallet}
      />
    </Wrapper>
  );
};

export default Header;

const Navigation = () => {
  const [selectorPosition, setSelectorPosition] = useState(0);

  const onMenuItemActive = useCallback((offsetX: number) => {
    const centerSelectorPostion = offsetX - (SELECTOR_WIDTH / 2);
    setSelectorPosition(centerSelectorPostion);
  }, [setSelectorPosition]);

  return (
    <NavWrapper>
      <Menu>
        <MenuItem
          to="/core"
          strictMatch
          onMenuItemActive={onMenuItemActive}
        >
          Home
        </MenuItem>
        <MenuItem
          to="/core/vaults"
          onMenuItemActive={onMenuItemActive}
        >
          Vaults
        </MenuItem>
        <MenuItem
          to="/core/trade"
          onMenuItemActive={onMenuItemActive}
        >
          Trade
        </MenuItem>
        <MenuItem
          to="/core/profile"
          onMenuItemActive={onMenuItemActive}
        >
          Profile
        </MenuItem>
        <MenuItem
          to="/core/analytics"
          onMenuItemActive={onMenuItemActive}
        >
          Analytics
        </MenuItem>
      </Menu>
      <Selector $position={selectorPosition} />
    </NavWrapper>
  );
};

interface MenuItemProps {
  to: string;
  strictMatch?: boolean;
  onMenuItemActive: (offsetX: number) => void;
}

const MenuItem: FC<MenuItemProps> = ({
  to,
  children,
  onMenuItemActive,
  strictMatch = false,
}) => {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: strictMatch });
  const menuItemRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    if (!match || !menuItemRef.current) {
      return;
    }

    const domNode = menuItemRef.current;
    const clientRect = domNode.getBoundingClientRect();
    const centerOffsetLeft = domNode.offsetLeft + (clientRect.width / 2);

    onMenuItemActive(centerOffsetLeft);
  }, [match, onMenuItemActive, menuItemRef]);

  return (
    <li>
      <NavLink
        ref={menuItemRef}
        to={to}
        $active={!!match}
      >
        {children}
      </NavLink>
    </li>
  );
};

const SELECTOR_WIDTH = 23;

// Component Colors
const COLOR_NAV_HOVER = '#FFDEC9';
const COLOR_NAV_SHADOW = '0px 0px 0.3125rem rgba(222, 92, 6, 0.5)';
const COLOR_NAV_BACKGROUND_GRADIENT_START = '#0B0A0A';
const COLOR_NAV_BACKGROUND_GRADIENT_END = '#1D1A1A';

const Wrapper = styled.header`
  background: linear-gradient(180deg, ${COLOR_NAV_BACKGROUND_GRADIENT_START} 0%, ${COLOR_NAV_BACKGROUND_GRADIENT_END} 100%);
  border-bottom: 0.0625rem solid ${({ theme }) => theme.palette.brand};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.75rem;
`;

const Logo = styled(Link)`
  ${backgroundImage(templeDaoLogo)}
  display: block;
  width: 2.625rem;
  height: 2.625rem;
  overflow: hidden;
  text-indent: -999rem;
`;

const Selector = styled.span<{ $position: number }>`
  ${backgroundImage(selectorIcon)}
  bottom: 0;
  content: '';
  width: ${SELECTOR_WIDTH}px;
  height: 1.5rem;
  position: absolute;

  transition: transform 250ms ease-in-out;
  display: ${({ $position }) => $position ? 'block' : 'none'};
  transform: translate(${({ $position }) => $position}px, 50%);
`;

const NavWrapper = styled.nav`
  position: relative;
`;

const Menu = styled(UnstyledList)`
  display: flex;
  flex-direction: row;
  border-left: 0.0625rem solid ${({ theme }) => theme.palette.brand};
  border-right: 0.0625rem solid ${({ theme }) => theme.palette.brand};
  position: relative;

  > li {
    border-right: 0.0625rem solid ${({ theme }) => theme.palette.brand};

    &:last-of-type {
      border-right: none;
    }
  }
`;

const MetamaskButton = styled.button`
  ${buttonResets}
  ${backgroundImage(metamaskLogo)}
  width: 3.4375rem;
  height: 3.375rem;
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

  padding: 1.625rem 0.875rem 1.3125rem;
  transition: all 150ms ease-in;

  color: ${({ theme, $active }) => $active ? COLOR_NAV_HOVER : theme.palette.brand};
  text-shadow: ${({ $active }) => $active ? COLOR_NAV_SHADOW : 'none'};

  &:hover {
    color: ${COLOR_NAV_HOVER};
    text-shadow: ${COLOR_NAV_SHADOW};
  }
`;
