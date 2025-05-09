import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TopNav } from './components/TopNav';
import { MobileTopNav } from './components/MobileTopNav';
import allSpices from 'assets/images/all-spices.svg?react';
import { useMediaQuery } from 'react-responsive';
import { queryPhone, queryMinTablet } from 'styles/breakpoints';
import { DisclaimerModal } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/DisclaimerModal';

enum SpiceLocPaths {
  Overview = '/dapp/spice/overview',
  Earn = '/dapp/spice/earn/staketemple/stake',
  Bid = '/dapp/spice/bid',
  Spend = '/dapp/spice/spend',
  MyActivity = '/dapp/spice/myactivity/tgld',
  Analytics = '/dapp/spice/analytics',
}

export const SpiceBazaarTopNav = () => {
  const SpiceBazaarConfig = [
    {
      label: 'Overview',
      linkTo: SpiceLocPaths.Overview,
    },
    {
      label: 'Earn Temple Gold',
      linkTo: SpiceLocPaths.Earn,
    },
    {
      label: 'Bid For Temple Gold',
      linkTo: SpiceLocPaths.Bid,
    },
    {
      label: 'Spend Temple Gold',
      linkTo: SpiceLocPaths.Spend,
    },
    {
      label: 'My Activity',
      linkTo: SpiceLocPaths.MyActivity,
      options: [
        { label: 'Bids for TGLD', path: '/dapp/spice/myactivity/tgld' },
        { label: 'Bids for Spice', path: '/dapp/spice/myactivity/spice' },
      ],
    },
    // {
    //   label: 'Analytics',    // not part of the MVP
    //   linkTo: SpiceLocPaths.Analytics,
    // },
  ];

  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const isTabletOrAbove = useMediaQuery({
    query: queryMinTablet,
  });
  const loc = useLocation();
  const [disclaimerModalOpen, setDisclaimerModalOpen] = useState(false);
  const [menuNavItems, setMenuNavItems] = useState(
    SpiceBazaarConfig.map((item) => ({
      label: item.label,
      path: item.linkTo,
      selected: item.linkTo === loc.pathname,
      options: item.options,
    }))
  );

  // Disabled for now
  // useEffect(() => {
  //   if (loc.pathname === SpiceLocPaths.Earn) {
  //     setDisclaimerModalOpen(true);
  //   }
  // }, [loc.pathname]);

  useEffect(() => {
    setMenuNavItems((prevMenuNavItems) =>
      prevMenuNavItems.map((menuItem) => ({
        ...menuItem,
        selected:
          menuItem.path === loc.pathname ||
          (menuItem.path === '/dapp/spice/earn/staketemple/stake' &&
            loc.pathname.startsWith('/dapp/spice/earn/staketemple')) ||
          (menuItem.path === '/dapp/spice/spend' &&
            loc.pathname.startsWith('/dapp/spice/spend')) ||
          (menuItem.path === '/dapp/spice/myactivity/tgld' &&
            loc.pathname.startsWith('/dapp/spice/myactivity')),
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
      {isTabletOrAbove && <AllSpices />}
      <PageContainer>
        <Content>
          {isPhoneOrAbove ? (
            <TopNav
              menuNavItems={menuNavItems}
              onSelectMenuNavItems={onSelectMenuNavItems}
              showSelector={true}
              positionSelector={'-20%'}
            />
          ) : (
            <MobileTopNav
              menuNavItems={menuNavItems}
              onSelectMenuNavItems={onSelectMenuNavItems}
            />
          )}
          <DisclaimerModal
            isOpen={disclaimerModalOpen}
            onClose={() => setDisclaimerModalOpen(false)}
          />
          <Outlet />
        </Content>
      </PageContainer>
    </>
  );
};

const PageContainer = styled.div`
  position: relative;
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
  height: auto;
  overflow: hidden;
`;
