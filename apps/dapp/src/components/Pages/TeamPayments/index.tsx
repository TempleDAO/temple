import { FunctionComponent, SVGProps, useState } from 'react';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { queryMinTablet } from 'styles/breakpoints';
import Footer from '../../Layouts/V2Layout/Footer';
import LeftNav from '../../Layouts/V2Layout/Nav/LeftNav';
import MobileNav from '../../Layouts/V2Layout/Nav/MobileNav';
import Cash from 'assets/icons/cash.svg?react';
import NonCash from 'assets/icons/non-cash.svg?react';
import Vesting from 'assets/icons/vesting.svg?react';

export type MenuNavItem = {
  label: string;
  linkTo: string;
  Logo: FunctionComponent<
    SVGProps<SVGSVGElement> & { title?: string | undefined }
  >;
  selected: boolean;
};

export type MenuNavItems = Array<MenuNavItem>;

enum DashboardLocPaths {
  Cash = '/team-payments/cash',
  NonCash = '/team-payments/non-cash',
  VestingDashboard = '/team-payments/vesting-dashboard',
}

const TeamPayments = () => {
  const isTabletOrAbove = useMediaQuery({ query: queryMinTablet });
  const loc = useLocation();

  const [isAdmin, setIsAdmin] = useState(false); //For manual swap between admin and contributor view

  const [selectedPath, setSelectedPath] = useState(loc.pathname);

  const onSelectMenuNavItems = (selectedMenuItem: MenuNavItem) => {
    setSelectedPath(selectedMenuItem.linkTo);
  };

  const menuNavItems: MenuNavItem[] = isAdmin
    ? [
        {
          label: 'Vesting\nDashboard',
          linkTo: DashboardLocPaths.VestingDashboard,
          Logo: Vesting,
          selected: selectedPath === DashboardLocPaths.VestingDashboard,
        },
      ]
    : [
        {
          label: 'Cash',
          linkTo: DashboardLocPaths.Cash,
          Logo: Cash,
          selected: selectedPath === DashboardLocPaths.Cash,
        },
        {
          label: 'Non-Cash',
          linkTo: DashboardLocPaths.NonCash,
          Logo: NonCash,
          selected: selectedPath === DashboardLocPaths.NonCash,
        },
      ];

  return (
    <ParentContainer>
      <MainContainer>
        {isTabletOrAbove ? (
          <LeftNav
            menuNavItems={menuNavItems}
            onSelectMenuNavItems={onSelectMenuNavItems}
          />
        ) : (
          <MobileNav
            menuNavItems={menuNavItems}
            onSelectMenuNavItems={onSelectMenuNavItems}
          />
        )}
        <Content>
          <SearchBar></SearchBar>
          <Outlet />
        </Content>
      </MainContainer>
      <Footer />
    </ParentContainer>
  );
};

export default TeamPayments;

const ParentContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  ${breakpoints.tabletAndAbove(`
    flex-direction: row;
  `)}
  flex-grow: 1;
`;

const Content = styled.div`
  width: 100%;
  height: 100%;
  flex-grow: 1;
  padding: 25px 20px;
  ${breakpoints.phoneAndAbove(`
    padding: 40px 120px 80px 120px;
  `)}
  background-color: ${(props) => props.theme.palette.dark};
`;

const SearchBar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  border: 1 solid ${(props) => props.theme.palette.dark};
`;
