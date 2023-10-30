import { useState } from 'react';
import styled from 'styled-components';

import Image from '../../../Image/Image';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import temple_dao_logo from '../assets/temple-dao-logo.png';
import core_hamburger from 'assets/icons/core-hamburger.svg';
import { MobileNavOverlay } from './MobileNavOverlay';
import NavLinks from './NavLinks';

const MobileNav = () => {
  const [panelOpen, setPanelOpen] = useState(false);

  const MenuItems = () => (
    <StyledNav>
      <NavLinks isNavCollapsed={false} onClickHandler={() => setPanelOpen(false)} />
    </StyledNav>
  );

  return (
    <NavContainer>
      <TempleLogo src={temple_dao_logo} />
      <HamburgerIcon src={core_hamburger} onClick={() => setPanelOpen(true)} />
      {panelOpen && <MobileNavOverlay Content={() => <MenuItems />} hidePanel={() => setPanelOpen(false)} />}
    </NavContainer>
  );
};

export default MobileNav;

const NavContainer = styled.div`
  box-sizing: border-box;
  padding-top: 1rem;
  padding-bottom: 1rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-image: url('${footerTexture}');
  height: 100%;
`;

const HamburgerIcon = styled(Image)`
  cursor: pointer;
  transition: all 300ms ease;
  width: 40px;
  height: 40px;
  margin-right: 20px;
  &:hover {
    filter: contrast(1000%);
  }
`;

const StyledNav = styled.nav`
  box-sizing: border-box;
  background-image: url('${footerTexture}');

  display: flex;
  gap: 2rem;
  flex-direction: column;
  padding-top: 1rem;
  padding-bottom: 1rem;
  padding-left: 1rem;
  height: 100%;
`;

const TempleLogo = styled(Image)`
  width: 40px;
  margin-left: 20px;
`;
