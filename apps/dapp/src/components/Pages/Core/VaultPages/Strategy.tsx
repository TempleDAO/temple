import React from 'react';

import VaultContent from 'components/Pages/Core/VaultPages/VaultContent';

import { Header } from 'styles/vault';
import styled from 'styled-components';
import { useVaultContext } from '../VaultContext';
import { DefaultText, strategies } from './strategies/Strategies';

export const Strategy = () => {
  const { vaultGroup } = useVaultContext();
  const id = vaultGroup.id;
  const strategyContent = strategies[id] || DefaultText;

  return (
    <VaultContent>
      <Header>Strategy</Header>
      {strategyContent}
    </VaultContent>
  );
};
