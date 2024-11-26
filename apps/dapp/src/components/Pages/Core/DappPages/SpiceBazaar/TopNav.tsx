import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TopNav } from './components/TopNav';
import { MobileTopNav } from './components/MobileTopNav';
import allSpices from 'assets/images/all-spices.svg?react';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

enum SpiceLocPaths {
  Earn = '/dapp/spice/earn',
  Bid = '/dapp/spice/bid',
  MyActivity = '/dapp/spice/myactivity/tgld',
  Analytics = '/dapp/spice/analytics',
}

const SpiceBazaarConfig = [
  {
    label: 'Earn Temple Gold',
    linkTo: SpiceLocPaths.Earn,
  },
  {
    label: 'Bid Temple Gold',
    linkTo: SpiceLocPaths.Bid,
  },
  {
    label: 'My Activity',
    linkTo: SpiceLocPaths.MyActivity,
  },
  {
    label: 'Analytics',
    linkTo: SpiceLocPaths.Analytics,
  },
];

export const SpiceBazaarTopNav = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const loc = useLocation();
  const [menuNavItems, setMenuNavItems] = useState(
    SpiceBazaarConfig.map((item) => ({
      label: item.label,
      path: item.linkTo,
      selected: item.linkTo === loc.pathname,
    }))
  );

  useEffect(() => {
    setMenuNavItems((prevMenuNavItems) =>
      prevMenuNavItems.map((menuItem) => ({
        ...menuItem,
        selected:
          menuItem.path === location.pathname ||
          (menuItem.path === '/dapp/spice/earn' &&
            location.pathname.startsWith('/dapp/spice/earn')) ||
          (menuItem.path === '/dapp/spice/bid' &&
            location.pathname.startsWith('/dapp/spice/bid')) ||
          (menuItem.path === '/dapp/spice/myactivity/tgld' &&
            location.pathname.startsWith('/dapp/spice/myactivity')),
      }))
    );
  }, [loc.pathname]);

  const onSelectMenuNavItems = (selectedMenuItem: { label: string }) => {
    setMenuNavItems(
      menuNavItems.map((item) => {
        if (item.label === selectedMenuItem.label) {
          return { ...item, selected: true };
        }
        return { ...item, selected: false };
      })
    );
  };

  return (
    <>
      {isPhoneOrAbove && <AllSpices />}
      <PageContainer>
        <Content>
          {isPhoneOrAbove ? (
            <TopNav
              menuNavItems={menuNavItems}
              onSelectMenuNavItems={onSelectMenuNavItems}
            />
          ) : (
            <MobileTopNav
              menuNavItems={menuNavItems}
              onSelectMenuNavItems={onSelectMenuNavItems}
            />
          )}
          <Outlet />
        </Content>
      </PageContainer>
    </>
  );
};
const PageContainer = styled.div`
  position: relative;
  z-index: 1;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 60px;
`;

const AllSpices = styled(allSpices)`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 0;
`;
