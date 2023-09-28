import { useState } from 'react';
import styled from 'styled-components';

import Image from '../../Image/Image';

import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import account_balance_wallet from './assets/account_balance_wallet.png';
import currency_exchange from './assets/currency_exchange.png';
import dashboard from './assets/dashboard.png';
import payments from './assets/payments.png';
import restore from './assets/restore.png';
import temple_dao_logo from './assets/temple-dao-logo.png';
import { Link } from 'react-router-dom';

const LeftNav = () => {
  const [isNavCollapsed, setNavCollapsed] = useState(true);

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
        <NavLink to="/">
          <NavLinkCell>
            <NavIcon src={account_balance_wallet} />
            {!isNavCollapsed && <NavLinkText>Connect</NavLinkText>}
          </NavLinkCell>
        </NavLink>
      </NavContent>
    </Nav>
  );
};

export default LeftNav;

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

const NavLinkText = styled.span`
  margin-left: 0.5rem;
  font-weight: 700;
  color: ${(props) => props.theme.palette.brand};
  vertical-align: middle;
  &:hover {
    text-decoration: underline;
  }
`;

const NavLinkCell = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  margin-top: 1rem;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background-color: ${(props) => props.theme.palette.brand25};
  }
`;

const NavLink = styled(Link)`
  // &:hover {
  //   text-decoration: underline;
  // }
`;
