import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { useTemplePool } from 'hooks/ascend';
import { Pool } from 'components/Layouts/Ascend/types';
import { SwapHistory } from './components/SwapHistory';
import { Chart } from './components/Chart';
import { useTimeRemaining } from 'hooks/ascend';
import { Trade } from './components/Trade';
import { AuctionContextProvider } from './components/AuctionContext';
import { ChartInfoBar } from './components/ChartInfoBar';
import { PoolComposition } from './components/PoolComposition';
import { NAV_MOBILE_HEIGHT_PIXELS } from 'components/Layouts/CoreLayout/Header';
import { phoneAndAbove } from 'styles/breakpoints';

import { Description, ChartTradeSection } from './styles';
import Loader from 'components/Loader/Loader';
import { createPool } from 'components/Layouts/Ascend/utils';

interface Props {
  pool: Pool;
}

const ActiveAuction = ({ pool }: Props) => {
  return (
    <Wrapper>
      <h3>Temple Ascend</h3>
      <Description>
        Temple Ascend is a Liquidity Bootstrapping Pool (LBP) designed to
        acquire $TEMPLE tokens from the circulating supply. During active
        Ascendance Rituals, the LBP is configured to where the $TEMPLE price
        will start low and gradually rise over time. However, price action is
        also affected by users trading the LBP.{' '}
        <a
          href="https://templedao.medium.com/temple-ascend-progressing-temple-mechanics-18d96b1fd783"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          Read more....
        </a>
      </Description>
      <ChartTradeSection>
        <div>
          <ChartInfoBar pool={pool} />
          <Chart pool={pool} />
        </div>
        <Trade pool={pool} />
      </ChartTradeSection>
      <PoolComposition />
      <SwapHistory pool={pool} />
    </Wrapper>
  );
};

export const AscendPage = () => {
  const { poolAddress } = useParams();
  const [request, { response, isLoading, error }] = useTemplePool(poolAddress);

  const pool = useMemo(() => {
    const pool = response?.data?.pools[0];
    if (!pool) {
      return undefined;
    }
    return createPool(pool);
  }, [response]);

  const timeRemaining = useTimeRemaining(pool);

  useEffect(() => {
    request();
  }, [request]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <h3>Something went wrong...</h3>;
  }

  if (!response) {
    return null;
  }

  if (!pool) {
    return (
      <>
        <h3>Check back soon...</h3>
      </>
    );
  }

  if (timeRemaining) {
    return (
      <>
        <h2>{pool.name}</h2>
        <h3>Launching in: {timeRemaining}</h3>
      </>
    );
  }

  return (
    <AuctionContextProvider pool={pool}>
      <ActiveAuction pool={pool} />
    </AuctionContextProvider>
  );
};

export const Wrapper = styled.div`
  margin: ${NAV_MOBILE_HEIGHT_PIXELS}px 0.625rem 2.5rem 0.625rem;
  ${phoneAndAbove(`
    margin: 0.625rem 2.5rem 2.5rem 2.5rem;
  `)}
`;
