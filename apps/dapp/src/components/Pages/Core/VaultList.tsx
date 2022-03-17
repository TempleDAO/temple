import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

import Loader from 'components/Loader/Loader';

const data = ['abc']

const useMockVaultData = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, [setIsLoading]);

  return { isLoading, data };
};

const VaultListPage = () => {
  const { isLoading, data } = useMockVaultData();

  if (isLoading) {
    return <Loader />;
  }

  if (data.length === 0 || !data) {
    return <div>Something went wrong</div>;
  }

  if (data.length === 1) {
    return <Navigate replace to={`/core/vaults/${data[0]}/summary`} />;
  }

  return <div>Vault List View</div>;
};

export default VaultListPage;
