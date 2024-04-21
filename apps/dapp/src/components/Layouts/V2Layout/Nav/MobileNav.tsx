import { useState } from 'react';
import styled from 'styled-components';

import Image from '../../../Image/Image';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import temple_dao_logo from 'assets/images/sun-art.svg';
import coreHamburger from 'assets/icons/core-hamburger.svg?react';
import { MobileNavOverlay } from './MobileNavOverlay';
import NavLinks from './NavLinks';
import { Link } from 'react-router-dom';
import { MenuNavItem, MenuNavItems } from '..';

type MobileNavProps = {
  menuNavItems: MenuNavItems;
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
};

const MobileNav = (props: MobileNavProps) => {
  const { menuNavItems, onSelectMenuNavItems } = props;
  const [slideIn, setSlideIn] = useState(false);

  const MenuItems = () => (
    <StyledNav>
      <NavLinks
        menuNavItems={menuNavItems}
        onSelectMenuNavItems={onSelectMenuNavItems}
        isNavCollapsed={false}
        onClickHandler={() => setSlideIn(false)}
      />
    </StyledNav>
  );

  return (
    <NavContainer>
      <TempleLink to="/">
        <TempleLogo src={temple_dao_logo} />
      </TempleLink>
      <HamburgerIcon onClick={() => setSlideIn(!slideIn)} />
      <MobileNavOverlay
        Content={() => <MenuItems />}
        hidePanel={() => setSlideIn(false)}
        slideIn={slideIn}
      />
    </NavContainer>
  );
};

export default MobileNav;

const NavContainer = styled.div`
  box-sizing: border-box;
  padding: 16px 20px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-image: url('${footerTexture}');
  height: 100%;
`;

const HamburgerIcon = styled(coreHamburger)`
  cursor: pointer;
  transition: all 300ms ease;
  fill: ${({ theme }) => theme.palette.brand};
  align-self: center;
  width: 24px;
  height: 24px;
  margin-right: 20px;
  &:hover {
    fill: ${({ theme }) => theme.palette.light75};
  }
`;

const StyledNav = styled.nav`
  box-sizing: border-box;
  background-image: url('${footerTexture}');

  display: flex;
  flex-direction: column;
  padding-top: 1rem;
  padding-bottom: 1rem;
  height: 100%;
`;

const TempleLogo = styled(Image)`
  width: 40px;
`;

const TempleLink = styled(Link)`
  width: 40px;
`;
