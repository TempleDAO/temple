import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { createPool } from 'components/Layouts/Ascend/utils';
import Loader from 'components/Loader/Loader';
import { LBPForm } from '../components/LBPForm';
import { useTemplePool } from 'hooks/ascend';
import { AuctionContextProvider } from 'components/Pages/Ascend/components/AuctionContext';

export const EditLBPPage = () => {
  const { poolAddress } = useParams();
  const [request, { response, error, isLoading }] = useTemplePool(
    poolAddress || ''
  );

  useEffect(() => {
    if (!poolAddress) {
      return;
    }

    request();
  }, [request, poolAddress]);

  if (!poolAddress) {
    return <LBPForm />;
  }

  if (isLoading) {
    return <Loader />;
  }

  if (error || !response?.data?.pools[0]) {
    return <h3>Error loading pool...</h3>;
  }

  const subgraphPool = response?.data?.pools[0];
  const pool = createPool(subgraphPool);

  return (
    <AuctionContextProvider pool={pool}>
      <LBPForm pool={pool} />
    </AuctionContextProvider>
  );
};
