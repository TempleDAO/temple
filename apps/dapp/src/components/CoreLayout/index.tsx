import { PropsWithChildren } from 'react';
import { Link, useResolvedPath, useMatch, Routes, Route, Navigate } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';

import { flexCenter } from 'styles/mixins';
import { UnstyledList } from 'styles/common';

import selectorIcon from './nav-selector-icon.svg';

const CoreLayout = () => (
  <>
    <GlobalStyleOverride />
    <Header>
      <NavLeft />
      <Navigation>
        <Menu>
          <MenuItem to="/core/dashboard">
            Dashboard
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
        </Menu>
      </Navigation>
      <NavRight />
    </Header>
    <Main>
      <Routes>
        <Route path="/dashboard" element={'Dashboard'} />
        <Route path="/vaults/*" element={'Vaults'} />
        <Route path="/trade" element={'Trade'} />
        <Route path="/profile" element={'Profile'} />
        <Route path="/*" element={<Navigate replace to="/" />} />
      </Routes>
    </Main>
  </>
);

interface MenuItemProps {
  to: string;
}

const MenuItem = ({ to, children }: PropsWithChildren<MenuItemProps>) => {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: false });

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

const GlobalStyleOverride = createGlobalStyle`
  html, body {
    overflow-x: visible;
    min-height: 100vh;
    min-width: 100vw;
  }
`;

const Header = styled.header`
  background: linear-gradient(180deg, #0B0A0A 0%, #1D1A1A 100%);
  border-bottom: 1px solid #BD7B4F;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  overflow-x: visible;
`;

const NavLeft = styled.div``;
const NavRight = styled.div``;

const Navigation = styled.nav`
  display: block;
  position: relative;
`;

const Menu = styled(UnstyledList)`
  display: flex;
  flex-direction: row;
  border-left: 1px solid #BD7B4F;
  border-right: 1px solid #BD7B4F;

  > li {
    border-right: 1px solid #BD7B4F;

    &:last-of-type {
      border-right: none;
    }
  }
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  ${flexCenter}
  ${({ theme }) => theme.typography.fonts.fontBody}

  font-size: 1rem;
  line-height: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  min-width: 7.5rem;

  padding: 26px 14px 21px;
  transition: all 150ms ease-in;

  color: ${({ theme, $active }) => $active ? '#FFDEC9' : theme.palette.brand};
  text-shadow: ${({ $active }) => $active ? '0px 0px 5px rgba(222, 92, 6, 0.5)' : 'none'};

  &:hover {
    color: #FFDEC9;
    text-shadow: 0px 0px 5px rgba(222, 92, 6, 0.5);
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

const Main = styled.main`
  max-width: ${({ theme }) => theme.metrics.devices.laptop};
  margin: 0 auto;
`;

export default CoreLayout;