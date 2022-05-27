import React from 'react';

import VaultContent from 'components/Pages/Core/VaultPages/VaultContent';

import { Header } from 'styles/vault';
import styled from 'styled-components';

export const Strategy = () => {
  return (
    <VaultContent>
      <Header>Strategy</Header>
      <StrategyContainer>
        <P>This is a fake vault used just for testing </P>
      </StrategyContainer>
    </VaultContent>
  );
};

const StrategyContainer = styled.div`
  color: #ffdec9;
  font-size: 1.5rem;
  margin: 30px 20px 0px 20px;
  height: 300px;
  text-align: left;
  padding: 10px;
`;

const P = styled.div`
  font-size: inherit;
`