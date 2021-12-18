import MetamaskButton from 'components/Button/MetamaskButton';
import React from 'react';
import styled from 'styled-components';
import useCustomRouting from 'hooks/use-custom-spa-routing';
import { useHash } from 'hooks/use-query';

import TempleGates from 'components/Pages/TempleGates';
import Account from 'components/Pages/Account';
import Foyer from 'components/Pages/Foyer';
import DashboardDoor from 'components/Pages/DashboardDoor';

const Container = styled.div`
  height: 100vh;
  width: 100vw;
`;

const AmmSpaRoot = () => {
  const hash = useHash();
  const isDiscordRedirect = hash.get('access_token') && hash.get('token_type');

  const routingHelper = useCustomRouting(
    TempleGates,
    isDiscordRedirect ? Account : TempleGates,
    isDiscordRedirect ? [TempleGates, Foyer, DashboardDoor] : []
  );
  const { CurrentPage } = routingHelper;

  return (
    <Container>
      <MetamaskButton />
      <CurrentPage routingHelper={routingHelper} />
    </Container>
  );
};

export default AmmSpaRoot;
