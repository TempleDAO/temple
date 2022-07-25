import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

import { useTemplePools } from 'hooks/ascend';
import Loader from 'components/Loader/Loader';

export const AscendListPage = () => {
  const [request, { response, isLoading, error }] = useTemplePools(1);

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <h3>{error.message}</h3>;
  }

  if (!response) {
    return null;
  }

  if (response?.data?.pools.length === 0) {
    return <h3>Nothing here...</h3>;
  }

  const pool = response.data?.pools[0];
  return <Navigate replace to={`/dapp/ascend/${pool!.address}`} />;
};
