import React, { useEffect } from 'react';

import VaultContent from 'components/Pages/Core/VaultPages/VaultContent';

import { Header } from 'styles/vault';
import { useVaultContext } from '../VaultContext';
import { DefaultText, strategies } from './strategies/Strategies';

export const Strategy = () => {
  const { vaultGroup } = useVaultContext();

  const id = vaultGroup!.id;
  const strategyContent = strategies[id] || DefaultText;

  useEffect(() => {
    if (strategyContent === DefaultText) {
      console.error(
        `Programming Error: Falling back to default strategy text for vault ${id}`
      );
    }
  }, [strategyContent, id]);

  return (
    <VaultContent>
      <Header>Strategy</Header>
      {strategyContent}
    </VaultContent>
  );
};
