import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { useTemplePools } from 'hooks/ascend';
import Loader from 'components/Loader/Loader';
import { createPool } from 'components/Layouts/Ascend/utils';

const EMPTY_LIQUIDITY_THRESHOLD = BigNumber.from(100);

const EMPTY_MESSAGE = (
  <>
    <h3>No existing or upcoming Ascend events</h3>
  </>
);

export const AscendListPage = () => {
  const [request, { response, isLoading, error }] = useTemplePools(1);

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <>
        <h3>{error.message}</h3>
      </>
    );
  }

  if (!response || !response?.data?.pools || response.data.pools.length === 0) {
    return EMPTY_MESSAGE;
  }

  const pool = createPool(response.data.pools[0]);
  const { endTimestamp } = pool.weightUpdates[pool.weightUpdates.length - 1];
  const now = Date.now();

  if (
    endTimestamp.getTime() < now &&
    pool.totalLiquidity.lt(EMPTY_LIQUIDITY_THRESHOLD)
  ) {
    return EMPTY_MESSAGE;
  }

  return <Navigate replace to={`/dapp/ascend/${pool.address}`} />;
};
