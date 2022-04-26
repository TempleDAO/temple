import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { phoneAndAbove } from 'styles/breakpoints';
import { theme } from 'styles/theme';

import { Provider as VaultsProvider } from 'components/VaultsProvider';
import Header from './Header';

const CoreLayout = () => (
  <VaultsProvider>
    <Header />
    <Main>
      <Outlet />
    </Main>
  </VaultsProvider>
);

export default CoreLayout;

const Main = styled.main`
  margin: 0 auto;
  padding: 0px;
  
  ${phoneAndAbove(`
    max-width: ${theme.metrics.desktop.maxWidth};
  `)}
`;
