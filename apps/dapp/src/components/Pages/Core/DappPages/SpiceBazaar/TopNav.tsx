import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TopNav } from './components/TopNav';
import { MobileTopNav } from './components/MobileTopNav';
import allSpices from 'assets/images/all-spices.svg?react';
import { useMediaQuery } from 'react-responsive';
import { queryPhone, queryMinTablet } from 'styles/breakpoints';
import { DisclaimerModal } from 'components/Pages/Core/DappPages/SpiceBazaar/Earn/DisclaimerModal';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';

enum SpiceLocPaths {
  Earn = '/dapp/spice/earn',
  Bid = '/dapp/spice/bid',
  MyActivity = '/dapp/spice/myactivity/tgld',
  Analytics = '/dapp/spice/analytics',
}

export const SpiceBazaarTopNav = () => {
  const { featureFlag } = useSpiceBazaar();

  const SpiceBazaarConfig = featureFlag.isEnabled
    ? [
        {
          label: 'Earn Temple Gold',
          linkTo: SpiceLocPaths.Earn,
          options: [
            { label: 'Overview', path: '/dapp/spice/earn' },
            {
              label: 'Stake TEMPLE',
              path: '/dapp/spice/earn/staketemple/stake',
            },
            { label: 'USDS Gold Auctions', path: '/dapp/spice/earn/auctions' },
          ],
        },
        {
          label: 'Bid Temple Gold',
          linkTo: SpiceLocPaths.Bid,
        },
        {
          label: 'My Activity',
          linkTo: SpiceLocPaths.MyActivity,
          options: [
            { label: 'Bids for TGLD', path: '/dapp/spice/myactivity/tgld' },
            { label: 'Bids for Spice', path: '/dapp/spice/myactivity/spice' },
          ],
        },
        {
          label: 'Analytics',
          linkTo: SpiceLocPaths.Analytics,
        },
      ]
    : [
        {
          label: 'Earn Temple Gold',
          linkTo: SpiceLocPaths.Earn,
          options: [
            { label: 'Overview', path: '/dapp/spice/earn' },
            {
              label: 'Stake TEMPLE',
              path: '/dapp/spice/earn/staketemple/stake',
            },
            { label: 'USDS Gold Auctions', path: '/dapp/spice/earn/auctions' },
          ],
        },
        // {
        //   label: 'Bid Temple Gold',
        //   linkTo: SpiceLocPaths.Bid,
        // },
        {
          label: 'My Activity',
          linkTo: SpiceLocPaths.MyActivity,
          options: [
            { label: 'Bids for TGLD', path: '/dapp/spice/myactivity/tgld' },
          ],
        },
        // {
        //   label: 'Analytics',
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
          (menuItem.path === '/dapp/spice/earn' &&
            loc.pathname.startsWith('/dapp/spice/earn')) ||
          (menuItem.path === '/dapp/spice/bid' &&
            loc.pathname.startsWith('/dapp/spice/bid')) ||
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
`;
