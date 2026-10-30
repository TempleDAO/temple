import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { TopNav } from '../components/TopNav';
import { FIXED_NOW } from './data/fixtures';
import { NowProvider } from './data/hooks';
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

export const GranaryLayout = () => {
  const { pathname } = useLocation();
  const p = pathname.replace(/\/$/, '');
  return (
    <NowProvider value={FIXED_NOW}>
      <Content>
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
        <Body>
          <Outlet />
        </Body>
      </Content>
    </NowProvider>
  );
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
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
`;
