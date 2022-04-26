import { createContext, FC, useEffect } from 'react';

import { useCoreVaults } from 'hooks/graphql/use-core-vaults';
import { useContext } from 'react';

interface Context {
  vaults: any[];
  isLoading: boolean;
}

const VaultsContext = createContext<Context>({ vaults: [], isLoading: false });

export const Provider: FC = ({ children }) => {
  const [request, { isLoading, error, response }] = useCoreVaults();

  useEffect(() => {
    request();
  }, [request]);

  return (
    <VaultsContext.Provider
      value={{
        isLoading,
        vaults: response?.data?.data?.vaults || [],
      }}
    >
      {children}
    </VaultsContext.Provider>
  );
};

export const useVaultsContext = () => useContext(VaultsContext);