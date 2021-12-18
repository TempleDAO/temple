import React from 'react';
import styled from 'styled-components';
import useCustomRouting from 'hooks/use-custom-spa-routing';
import { useHash } from 'hooks/use-query';

import TempleGates from 'components/Pages/TempleGates';
import Account from 'components/Pages/Account';
import Foyer from 'components/Pages/Foyer';
import DungeonPoster from 'components/Pages/DungeonPoster';

const Container = styled.div`
  height: 100vh;
  width: 100vw;
`;

const AmmSpaRoot = () => {
  const hash = useHash();
  const isDiscordRedirect = hash.get('access_token') && hash.get('token_type');

  const routingHelper = useCustomRouting(
    TempleGates,
    isDiscordRedirect ? Account : undefined,
    isDiscordRedirect ? [TempleGates, Foyer, DungeonPoster] : []
  );
  const { CurrentPage } = routingHelper;

  return (
    <Container>
      <CurrentPage routingHelper={routingHelper} />
    </Container>
  );
};

export default AmmSpaRoot;
