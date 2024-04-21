import styled from 'styled-components';

import Image from '../../../Image/Image';
import temple_dao_logo from 'assets/images/sun-art.svg';

import { Link } from 'react-router-dom';
import { tabletAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';
import { MenuNavItem, MenuNavItems } from '..';
import { WalletNav } from './WalletNav';

type NavLinksProps = {
  menuNavItems: MenuNavItems;
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
  isNavCollapsed?: boolean;
  onClickHandler?: () => void;
};

const NavLinks = (props: NavLinksProps) => {
  const {
    menuNavItems,
    onSelectMenuNavItems,
    isNavCollapsed = false,
    onClickHandler,
  } = props;

  const onMenuClick = async (mi: MenuNavItem) => {
    await onSelectMenuNavItems(mi);
    if (onClickHandler) onClickHandler();
  };

  return (
    <>
      <TempleLink to="/">
        <TempleLogo src={temple_dao_logo} />
      </TempleLink>
      <VertNavContainer>
        {menuNavItems.map((mi) => (
          <NavLinkContainer key={mi.label} lightcolor={mi.selected}>
            <NavLink to={mi.linkTo} onClick={() => onMenuClick(mi)}>
              <NavLinkCell lightcolor={mi.selected}>
                <mi.Logo
                  id={mi.label}
                  fill={
                    mi.selected ? theme.palette.brandLight : theme.palette.brand
                  }
                />
                {!isNavCollapsed && (
                  <NavLinkText lightcolor={mi.selected}>{mi.label}</NavLinkText>
                )}
              </NavLinkCell>
            </NavLink>
          </NavLinkContainer>
        ))}
      </VertNavContainer>
      <Separator />
      <WalletNav
        isNavCollapsed={isNavCollapsed}
        onClickHandler={onClickHandler}
      />
    </>
  );
};

export default NavLinks;

const TempleLogo = styled(Image)`
  width: 40px;
  ${tabletAndAbove(`
    margin-bottom: 40px;
    margin-top: 5px;
    align-self: center;
  `)};
`;

const TempleLink = styled(Link)`
  padding-left: 1rem;
  width: 40px;
  margin-bottom: 30px;
`;

const Separator = styled.hr`
  margin: 10px 0;
  position: relative;
  border: 0;
  width: 100%;
  border-top: 1px solid ${(props) => props.theme.palette.brand}};
`;

type NavLinkProps = {
  small?: boolean;
  lightcolor?: boolean;
};

const VertNavContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const NavLinkText = styled.span<NavLinkProps>`
  margin-left: 0.5rem;
  font-weight: 700;
  color: ${({ theme, lightcolor }) =>
    lightcolor ? theme.palette.brandLight : theme.palette.brand};
  vertical-align: middle;
  &:hover {
    text-decoration: underline;
  }
  font-size: ${(props) => (props.small ? '0.75rem' : '1rem')};
`;

const NavLinkCell = styled.div<NavLinkProps>`
  display: flex;
  align-items: center;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 5px;
  fill: ${({ lightcolor, theme }) =>
    lightcolor ? theme.palette.brandLight : 'current'};
`;

const NavLinkContainer = styled.div<NavLinkProps>`
  height: 56px;
  padding: 16px 40px 16px 30px;
  background: ${({ lightcolor, theme }) =>
    lightcolor ? theme.palette.gradients.greyVertical : 'none'};
  &:hover {
    background-color: ${({ theme }) => theme.palette.brand25};
  }
  ${tabletAndAbove(`
    padding-left: 25px;
  `)}
`;

const NavLink = styled(Link)`
  display: flex;
  align-items: center;
  flex-direction: row;
  &:hover {
    text-decoration: underline;
  }
`;
