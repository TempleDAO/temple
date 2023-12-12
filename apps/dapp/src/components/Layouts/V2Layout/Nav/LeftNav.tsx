import { useState } from 'react';
import styled from 'styled-components';

import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import NavLinks from './NavLinks';
import { MenuNavItem, MenuNavItems } from '..';

type LeftNavProps = {
  menuNavItems: MenuNavItems;
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
};

const LeftNav = (props: LeftNavProps) => {
  const { menuNavItems, onSelectMenuNavItems } = props;
  const [isNavCollapsed, setNavCollapsed] = useState(true);

  return (
    <Nav
      collapsed={isNavCollapsed}
      onMouseEnter={() => setNavCollapsed(false)}
      onMouseLeave={() => setNavCollapsed(true)}
    >
      <NavContent collapsed={isNavCollapsed}>
        <NavLinks
          menuNavItems={menuNavItems}
          onSelectMenuNavItems={onSelectMenuNavItems}
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
  width: 100%;
`;
