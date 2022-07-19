import { SubgraphPool } from 'components/Layouts/Ascend/types';
import { createPool } from 'components/Layouts/Ascend/utils';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LBPForm } from '../components/LBPForm';
import { useTemplePool } from '../hooks';

export const EditLBPPage = () => {
  const { poolAddress } = useParams();

  if (!poolAddress) {
    return <LBPForm />;
  }

  const [request, { response, error }] = useTemplePool(poolAddress);

  useEffect(() => {
    request();
  }, [request]);

  if (error || !response?.data?.pools[0]) {
    return <h3>Error loading pool...</h3>;
  }

  const subgraphPool:SubgraphPool = response?.data?.pools[0];
  const pool = createPool(subgraphPool);

  return <LBPForm pool={pool}/>;
};
