import React from 'react';
import styled from 'styled-components';
import TempleGates from 'components/Pages/TempleGates';
import useCustomRouting from 'hooks/use-custom-spa-routing';

const Container = styled.div`
  height: 100vh;
  width: 100vw;
`;

const AmmSpaRoot = () => {
  const routingHelper = useCustomRouting(TempleGates);
  const { CurrentPage } = routingHelper;

  return (
    <Container>
      <CurrentPage routingHelper={routingHelper} />
    </Container>
  );
};

export default AmmSpaRoot;
