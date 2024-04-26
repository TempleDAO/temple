import { FunctionComponent, SVGProps, useEffect, useState } from 'react';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import styled from 'styled-components';
import { queryMinTablet } from 'styles/breakpoints';
import Footer from './Footer';
import LeftNav from './Nav/LeftNav';
import MobileNav from './Nav/MobileNav';

import Dashboard from 'assets/icons/dashboard.svg?react';
import CurrencyExchange from 'assets/icons/currency_exchange.svg?react';
import Payments from 'assets/icons/payments.svg?react';
import Candle from 'assets/icons/candle.svg?react';
import Restore from 'assets/icons/restore.svg?react';
import { useGeoBlocked } from 'hooks/use-geo-blocked';
import GeoblockModal from 'components/Popover/GeoblockModal';

export type MenuNavItem = {
  label: string;
  linkTo: string;
  Logo: FunctionComponent<
    SVGProps<SVGSVGElement> & { title?: string | undefined }
  >;
  selected: boolean;
};

export type MenuNavItems = Array<MenuNavItem>;

enum V2DashboardLocPaths {
  Trade = '/dapp/trade',
  Trv = '/dapp/dashboard/treasuryreservesvault',
  Borrow = '/dapp/borrow',
  Ohmage = '/dapp/ohmage',
  Legacy = '/dapp/legacy',
}

const V2Layout = () => {
  const isTabletOrAbove = useMediaQuery({
    query: queryMinTablet,
  });
  const loc = useLocation();
  const navigate = useNavigate();
  const { isBlocked, loading } = useGeoBlocked();
  const [geoblockModalOpen, setGeoblockModalOpen] = useState(false);
  const [menuNavItems, setMenuNavItems] = useState<Array<MenuNavItem>>([
    {
      label: 'Trade',
      linkTo: V2DashboardLocPaths.Trade,
      Logo: CurrencyExchange,
      selected: V2DashboardLocPaths.Trade === loc.pathname,
    },
    {
      label: 'Dashboard',
      linkTo: V2DashboardLocPaths.Trv,
      Logo: Dashboard,
      selected: V2DashboardLocPaths.Trv === loc.pathname,
    },
    {
      label: 'Borrow',
      linkTo: V2DashboardLocPaths.Borrow,
      Logo: Payments,
      selected: V2DashboardLocPaths.Borrow === loc.pathname,
    },
    {
      label: 'Ohmage',
      linkTo: V2DashboardLocPaths.Ohmage,
      Logo: Candle,
      selected: V2DashboardLocPaths.Ohmage === loc.pathname,
    },
    {
      label: 'Legacy',
      linkTo: V2DashboardLocPaths.Legacy,
      Logo: Restore,
      selected: V2DashboardLocPaths.Legacy === loc.pathname,
    },
  ]);

  // Handle geoblocked users
  useEffect(() => {
    // Define all permitted paths
    const permittedPaths = ['/dapp/legacy'];
    if (loading || (!loading && !isBlocked)) return;
    // Force redirect to permitted path
    if (!permittedPaths.find((path) => path === loc.pathname)) {
      navigate(permittedPaths[0]);
    }
    // Remove nav items that are not permitted
    if (menuNavItems.length > permittedPaths.length) {
      const newMenuNavItems = menuNavItems.filter((menuItem) =>
        permittedPaths.find((path) => path === menuItem.linkTo)
      );
      setMenuNavItems(newMenuNavItems);
      setGeoblockModalOpen(true);
    }
  }, [loading, isBlocked, loc, navigate, menuNavItems]);

  const onSelectMenuNavItems = async (selectedMenuItem: MenuNavItem) => {
    await setMenuNavItems((prevSelectedMenuNavItems) => {
      const newSelectedMenuNavItems = prevSelectedMenuNavItems.map(
        (prevMenuItem) => {
          if (prevMenuItem == selectedMenuItem) {
            return { ...prevMenuItem, selected: true };
          }
          return { ...prevMenuItem, selected: false };
        }
      );
      return newSelectedMenuNavItems;
    });
  };

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
          <GeoblockModal
            isOpen={geoblockModalOpen}
            onClose={() => setGeoblockModalOpen(false)}
          />
          <Outlet />
        </Content>
      </MainContainer>
      <Footer />
    </ParentContainer>
  );
};

export default V2Layout;

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
