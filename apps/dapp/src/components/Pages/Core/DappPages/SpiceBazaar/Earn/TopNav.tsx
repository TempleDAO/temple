import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/TopNav';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

enum EarnLocPaths {
  Overview = '/dapp/spice/earn',
  Stake = '/dapp/spice/earn/staketemple/stake',
  Auctions = '/dapp/spice/earn/auctions',
}

const EarnConfig = [
  {
    label: 'Overview',
    linkTo: EarnLocPaths.Overview,
  },
  {
    label: 'Stake TEMPLE',
    linkTo: EarnLocPaths.Stake,
  },
  {
    label: 'USDS Gold Auctions',
    linkTo: EarnLocPaths.Auctions,
  },
];

export const EarnTopNav = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const loc = useLocation();
  const [menuNavItems, setMenuNavItems] = useState(
    EarnConfig.map((item) => ({
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
          menuItem.path === loc.pathname ||
          (menuItem.path === '/dapp/spice/earn/staketemple/stake' &&
            loc.pathname.startsWith('/dapp/spice/earn/staketemple')),
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
      {isPhoneOrAbove && (
        <TopNav
          height="40px"
          fontWeight={700}
          borderButtomGradient="linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)"
          borderVerticalStyle="0.5px"
          borderBottomWidth="0.5px"
          backgroundColor="#351F1133"
          menuNavItems={menuNavItems}
          onSelectMenuNavItems={onSelectMenuNavItems}
          showSelector={true}
        />
      )}
    </>
  );
};
