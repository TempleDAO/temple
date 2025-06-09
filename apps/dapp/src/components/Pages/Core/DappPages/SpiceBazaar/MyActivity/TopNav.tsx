import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/TopNav';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { getAppConfig } from 'constants/newenv';

enum MyActivityLocPaths {
  Tgld = '/dapp/spice/myactivity/tgld',
  Spice = '/dapp/spice/myactivity/spice',
}

export const MyActivityTopNav = () => {
  const spiceAuctions = getAppConfig().spiceBazaar.spiceAuctions;
  const hasSpiceAuctions = spiceAuctions.length > 0;

  const MyActivityConfig = [
    {
      label: 'Bids for TGLD',
      linkTo: MyActivityLocPaths.Tgld,
    },
    {
      label: 'Bids for Spice',
      linkTo: MyActivityLocPaths.Spice,
    },
  ];

  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const loc = useLocation();
  const filteredMyActivityConfig = MyActivityConfig.filter((item) => {
    if (item.label === 'Bids for Spice' && !hasSpiceAuctions) return false;
    return true;
  });
  const [menuNavItems, setMenuNavItems] = useState(
    filteredMyActivityConfig.map((item) => ({
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
