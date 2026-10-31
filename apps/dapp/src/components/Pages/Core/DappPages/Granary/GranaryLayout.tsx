import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TopNav } from 'components/Pages/Core/DappPages/SpiceBazaar/components/TopNav';
import Loader from 'components/Loader/Loader';
import { GranaryProvider, useGranary } from 'providers/GranaryProvider';
import { NowProvider, useTickingNow } from './data/hooks';
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
    <NowProvider value={useTickingNow()}>
      <Content>
        <Nav />
        <Body>
          <Ready>
            <Outlet />
          </Ready>
        </Body>
      </Content>
    </NowProvider>
  </GranaryProvider>
);

const Nav = () => {
  const { pathname } = useLocation();
  const p = pathname.replace(/\/$/, '');
  return (
    <TopNav
      menuNavItems={TABS.map((t) => ({
        label: t.label,
        path: t.path,
        selected: t.match(p),
      }))}
      onSelectMenuNavItems={() => undefined}
      showSelector
      positionSelector="-20%"
    />
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
