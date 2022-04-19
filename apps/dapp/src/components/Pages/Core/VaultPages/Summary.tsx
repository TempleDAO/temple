import React from 'react';

import VaultContent from 'components/Vault/VaultContent';
import VaultSummary from 'components/Vault/VaultSummary';

import useVaultContext from './useVaultContext';

export const Summary = () => {
  const {vault} = useVaultContext();

  return (
    <VaultContent>
      <VaultSummary vault={vault} />
    </VaultContent>
  );
};
