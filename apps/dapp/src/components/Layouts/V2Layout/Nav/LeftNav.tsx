import { useState } from 'react';
import styled from 'styled-components';

import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import NavLinks from './NavLinks';

const LeftNav = () => {
  const [isNavCollapsed, setNavCollapsed] = useState(true);

  return (
    <Nav
      collapsed={isNavCollapsed}
      onMouseEnter={() => setNavCollapsed(false)}
      onMouseLeave={() => setNavCollapsed(true)}
    >
      <NavContent collapsed={isNavCollapsed}>
        <NavLinks
          isNavCollapsed={isNavCollapsed}
        />
      </NavContent>
    </Nav>
  );
};

export default LeftNav;

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
