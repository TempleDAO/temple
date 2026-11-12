import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { TopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/TopNav';
import { MobileTopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/MobileTopNav';
import Loader from 'components/Loader/Loader';
import { GranaryProvider, useGranary } from 'providers/GranaryProvider';
import { NowProvider, useTickingNow, WallClockProvider } from './data/hooks';
import { BASE, paths } from './paths';

const TABS = [
  { label: 'Overview', path: paths.overview, match: (p: string) => p === BASE },
  {
    label: 'Earn Temple Gold',
    path: paths.earn,
    match: (p: string) => p.startsWith(paths.earn),
  },
  {
    label: 'Auctions',
    path: paths.auctions(),
    match: (p: string) => /^\/dapp\/granary\/(auctions|pair|wish)/.test(p),
  },
  {
    label: 'My Activity',
    path: paths.activity,
    match: (p: string) => p.startsWith(paths.activity),
  },
];

export const GranaryLayout = () => (
  <GranaryProvider>
    <Clocks>
      <Content>
        <Nav />
        <Body>
          <Ready>
            <Outlet />
          </Ready>
        </Body>
      </Content>
    </Clocks>
  </GranaryProvider>
);

// useNow() is the indexer's block time; useWallClock() the browser's.
const Clocks = ({ children }: { children: JSX.Element }) => {
  const wall = useTickingNow();
  const indexed = useGranary().indexerStatus.data?.blockTime;
  return (
    <WallClockProvider value={wall}>
      <NowProvider value={indexed ?? wall}>{children}</NowProvider>
    </WallClockProvider>
  );
};

// Spice Bazaar's nav: the tab bar, or below phone width its scrolling strip.
const Nav = () => {
  const { pathname } = useLocation();
  const p = pathname.replace(/\/$/, '');
  const wide = useMediaQuery({ query: queryPhone });
  const items = TABS.map((t) => ({
    label: t.label,
    path: t.path,
    selected: t.match(p),
  }));
  const strip = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.selected)?.label;
  // the strip doesn't show its selected tab by itself: scroll it to the middle
  useLayoutEffect(() => {
    const cell = Array.from(strip.current?.querySelectorAll('div') ?? []).find(
      (d) => d.childElementCount === 0 && d.textContent === current
    );
    const scroller = cell?.parentElement?.parentElement;
    if (!cell || !scroller) return;
    const c = cell.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    scroller.scrollLeft += c.left + c.width / 2 - (s.left + s.width / 2);
  }, [current, wide]);
  if (wide)
    return (
      <TopNav
        menuNavItems={items}
        onSelectMenuNavItems={() => undefined}
        showSelector
        positionSelector="-20%"
      />
    );
  return (
    <div ref={strip}>
      <MobileTopNav
        menuNavItems={items}
        onSelectMenuNavItems={() => undefined}
      />
    </div>
  );
};

// Screens assume the indexer and account data are in, so hold them until the
// first load finishes. Later refetches keep the old data on screen. The splash
// needs no data.
const Ready = ({ children }: { children: JSX.Element }) => {
  const { pathname } = useLocation();
  const g = useGranary();
  const splash = pathname.replace(/\/$/, '') === BASE;
  const loading = [
    g.auctions,
    g.pairs,
    g.wishTokens,
    g.indexerStatus,
    g.positions,
    g.wishes,
    g.balances,
    g.staking,
  ].some((q) => q.isLoading);
  if (loading && !splash)
    return (
      <Center>
        <Loader iconSize={48} />
      </Center>
    );
  return children;
};

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
  position: relative;
  z-index: 10;
  color: #e9dcd2;
  font-size: 15px;
  line-height: 1.6;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
`;

const Center = styled.div`
  display: flex;
  justify-content: center;
  padding: 80px 0;
`;
