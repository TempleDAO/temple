import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/TopNav';
import { MobileTopNavSecondary } from 'components/Pages/Core/DappPages/SpiceBazaar/components/MobileTopNavSecondary';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

enum BidLocPaths {
  Bid = '/dapp/spice/bid',
}

const BidConfig = [
  {
    label: 'Spice Auctions',
    linkTo: BidLocPaths.Bid,
  },
];

export const BidTopNav = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const loc = useLocation();
  const [menuNavItems, setMenuNavItems] = useState(
    BidConfig.map((item) => ({
      label: item.label,
      path: item.linkTo,
      selected: item.linkTo === loc.pathname,
    }))
  );

  useEffect(() => {
    setMenuNavItems((prevMenuNavItems) =>
      prevMenuNavItems.map((menuItem) => ({
        ...menuItem,
        selected: menuItem.path === loc.pathname,
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
      {isPhoneOrAbove ? (
        <TopNav
          height="40px"
          fontWeight={400}
          borderButtomGradient="linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)"
          borderVerticalStyle="0.5px"
          borderBottomWidth="0.5px"
          backgroundColor="#351F1133"
          menuNavItems={menuNavItems}
          onSelectMenuNavItems={onSelectMenuNavItems}
          showSelector={true}
        />
      ) : (
        <MobileTopNavSecondary
          menuNavItems={menuNavItems}
          onSelectMenuNavItems={onSelectMenuNavItems}
        />
      )}
    </>
  );
};
