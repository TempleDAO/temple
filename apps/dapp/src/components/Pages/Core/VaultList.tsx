import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const { isLoading, data } = useMockVaultData();

  if (isLoading) {
    return <Loader />
  }

  if (data.length === 0) {
    return <div>Something went wrong</div>;
  }

  if (data.length > 1) {
    return <div>List view</div>;
  }

  return <Navigate replace to={`/core/vaults/${data[0]}/summary`} />;
};

export default VaultListPage;
