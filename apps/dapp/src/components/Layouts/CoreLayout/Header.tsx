import {
  FC,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  SyntheticEvent,
} from 'react';
import { Link, useResolvedPath, useMatch } from 'react-router-dom';
import styled from 'styled-components';

import {
  flexCenter,
  buttonResets,
  backgroundImage,
  pixelsToRems,
} from 'styles/mixins';
import { UnstyledList } from 'styles/common';
import { theme } from 'styles/theme';
import { phoneAndAbove, verySmallDesktop } from 'styles/breakpoints';
import { Lottie } from 'components/Lottie';

import selectorIcon from 'assets/icons/nav-selector-icon.svg';
import hamburger from 'assets/icons/core-hamburger.svg';
import hamburgerX from 'assets/icons/core-x-hamburger.svg';
import animationData from 'assets/animations/logo-animation.json';
import mobileBackgoundImage from 'assets/images/mobile-background-geometry.svg';
import { Account } from './Account';

const Header = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const onClickMenuItem = useCallback(() => {
    setIsNavOpen(false);
  }, [setIsNavOpen]);

  return (
    <>
      <Wrapper id="Wrapper">
        <MobileNavLeft>
          <HamburgerBun
            aria-label={`${isNavOpen ? 'Close' : 'Open'} navigation`}
            $isOpen={isNavOpen}
            onClick={() => setIsNavOpen((isOpen) => !isOpen)}
          />
          <Logo to="/core">
            <Lottie animationData={animationData} height={36} width={36} />
          </Logo>
        </MobileNavLeft>
        <Navigation
          isNavOpenMobile={isNavOpen}
          onClickMenuItem={onClickMenuItem}
        />
        <AccountWrapper>
          <Account />
        </AccountWrapper>
      </Wrapper>
    </>
  );
};

export default Header;

interface NavigationProps {
  isNavOpenMobile: boolean;
  onClickMenuItem?: (event: SyntheticEvent) => void;
}

const Navigation = ({ isNavOpenMobile, onClickMenuItem }: NavigationProps) => {
  const [selectorPosition, setSelectorPosition] = useState(0);

  const onMenuItemActive = useCallback(
    (offsetX: number) => {
      const centerSelectorPostion = offsetX - SELECTOR_WIDTH / 2;
      setSelectorPosition(centerSelectorPostion);
    },
    [setSelectorPosition]
  );

  return (
    <NavWrapper $isOpen={isNavOpenMobile}>
      <MenuWrapper>
        <Menu id="menu">
          <MenuItem
            to="/dapp/vaults"
            onMenuItemActive={onMenuItemActive}
            onClick={onClickMenuItem}
          >
            Vaults
          </MenuItem>
          <MenuItem
            to="/dapp/trade"
            onMenuItemActive={onMenuItemActive}
            onClick={onClickMenuItem}
          >
            Trade
          </MenuItem>
          <MenuItem
            to="/dapp/profile"
            onMenuItemActive={onMenuItemActive}
            onClick={onClickMenuItem}
          >
            Profile
          </MenuItem>
          <MenuItem
            to="/dapp/analytics"
            onMenuItemActive={onMenuItemActive}
            onClick={onClickMenuItem}
          >
            Analytics
          </MenuItem>
          <MenuItem
            to="/dapp/nexus"
            onMenuItemActive={onMenuItemActive}
            onClick={onClickMenuItem}
          >
            Nexus
          </MenuItem>
        </Menu>
        <Selector $position={selectorPosition} />
      </MenuWrapper>
    </NavWrapper>
  );
};

interface MenuItemProps {
  to: string;
  strictMatch?: boolean;
  onMenuItemActive: (offsetX: number) => void;
  onClick?: (event: SyntheticEvent) => void;
}

const MenuItem: FC<MenuItemProps> = ({
  to,
  children,
  onMenuItemActive,
  strictMatch = false,
  onClick,
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
    const centerOffsetLeft = domNode.offsetLeft + clientRect.width / 2;

    onMenuItemActive(centerOffsetLeft);
  }, [match, onMenuItemActive, menuItemRef]);

  return (
    <li>
      <NavLink ref={menuItemRef} to={to} $active={!!match} onClick={onClick}>
        {children}
      </NavLink>
    </li>
  );
};

const SELECTOR_WIDTH = 23; // pixels
export const NAV_MOBILE_HEIGHT_PIXELS = 52; // pixels
export const NAV_DESKTOP_HEIGHT_PIXELS = 52; // pixels

// Component Colors
const COLOR_NAV_SHADOW_DESKTOP = '0px 0px 0.3125rem rgba(222, 92, 6, 0.5)';
const COLOR_NAV_SHADOW_MOBILE = '0px 0px 0.6428rem rgba(222, 92, 6, 0.5)';
const COLOR_NAV_BACKGROUND_GRADIENT_START = '#0B0A0A';
const COLOR_NAV_BACKGROUND_GRADIENT_END = '#1D1A1A';
const COLOR_NAV_BORDER = '#BD7B4F61';

const HamburgerBun = styled.button<{ $isOpen: boolean }>`
  ${buttonResets}
  ${({ $isOpen }) =>
    backgroundImage($isOpen ? hamburgerX : hamburger, {
      position: 'left center',
    })}
  width: ${({ $isOpen }) => ($isOpen ? 1.3125 : 1.3125)}rem;
  height: ${({ $isOpen }) => ($isOpen ? 1 : 0.875)}rem;
  margin-right: 1.125rem;

  ${phoneAndAbove(`
    display: none;
  `)}
`;

const AccountWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const MobileNavLeft = styled.div`
  display: flex;
  align-items: center;
`;

const Wrapper = styled.header`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.75rem;
  height: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
  background: ${COLOR_NAV_BACKGROUND_GRADIENT_START};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndexes.top};

  ${phoneAndAbove(`
    height: ${pixelsToRems(NAV_DESKTOP_HEIGHT_PIXELS)}rem;
    position: relative;
    height: 3.25rem; // 52px
    background: linear-gradient(180deg, ${COLOR_NAV_BACKGROUND_GRADIENT_START} 0%, ${COLOR_NAV_BACKGROUND_GRADIENT_END} 100%);
    border-bottom: 0.0625rem solid ${COLOR_NAV_BORDER};
  `)}
`;

const Logo = styled(Link)`
  display: block;
  width: 2.125rem;
  height: 2.125rem;
  overflow: hidden;
  

  ${phoneAndAbove(`
    width: 2.125rem;
    height: 2.125rem;
  `)}
`;

const Selector = styled.span<{ $position: number }>`
  ${backgroundImage(selectorIcon)}

  display: none;
  bottom: 0;
  content: '';
  width: ${pixelsToRems(SELECTOR_WIDTH)}rem;
  height: 1.5rem;
  position: absolute;

  transition: transform 250ms ease-in-out;
  transform: translate(${({ $position }) => pixelsToRems($position)}rem, 50%);

  ${({ $position }) =>
    phoneAndAbove(`
    display: ${$position ? 'block' : 'none'};
  `)}
`;

const NavWrapper = styled.nav<{ $isOpen: boolean }>`
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  position: fixed;
  top: ${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;
  left: 0;
  right: 0;
  bottom: 0;
  align-items: center;
  z-index: ${({ theme }) => theme.zIndexes.max};

  ${backgroundImage(mobileBackgoundImage, {
    color: COLOR_NAV_BACKGROUND_GRADIENT_START,
    size: 'cover',
  })}

  ${phoneAndAbove(`
    top: 0;
    padding-top: 0;
    justify-content: center;
    background: transparent;
    position: absolute;
    display: flex;
    left: 50%;
    transform: translate(-50%);
    margin: 0 auto;
    text-align: center;
  `)}
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const Menu = styled(UnstyledList)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 1.9375rem;
  top: -${pixelsToRems(NAV_MOBILE_HEIGHT_PIXELS)}rem;

  > li {
    margin-bottom: 2.5rem;

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  ${phoneAndAbove(`
    top: 0;
    padding: 0;
    flex-direction: row;
    // border-left: 0.0625rem solid ${COLOR_NAV_BORDER};
    // border-right: 0.0625rem solid ${COLOR_NAV_BORDER};

    > li {
      margin: 0;
      border-right: 0.0625rem solid ${COLOR_NAV_BORDER};

      &:last-of-type {
        border-right: none;
      }
    }
  `)}
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  ${flexCenter}
  ${({ theme }) => theme.typography.fonts.fontBody}

  font-size: 2rem;
  line-height: 2.3125rem;
  letter-spacing: 0.1em;
  font-weight: normal;
  transition: all 150ms ease-in;

  color: ${({ theme, $active }) =>
    $active ? theme.palette.brandLight : theme.palette.brand};
  text-shadow: ${({ $active }) => ($active ? COLOR_NAV_SHADOW_MOBILE : 'none')};

  &:hover {
    color: ${theme.palette.brandLight};
    text-shadow: ${({ $active }) =>
      $active ? COLOR_NAV_SHADOW_MOBILE : 'none'};
  }

  ${({ $active }) =>
    phoneAndAbove(`
    font-size: .95rem;
    line-height: 0.25rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    min-width: 7.5rem;
    position: relative;

    padding: 1.625rem 0.875rem 1.3125rem;

    text-shadow: ${$active ? COLOR_NAV_SHADOW_DESKTOP : 'none'};

    &:hover {
      text-shadow: ${COLOR_NAV_SHADOW_DESKTOP};
    }
  `)}

  ${verySmallDesktop(`
    min-width: 5rem;
  `)}
`;
