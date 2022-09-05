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

import {
  Description,
  ChartTradeSection,
} from './styles';
import Loader from 'components/Loader/Loader';
import { createPool } from 'components/Layouts/Ascend/utils';

interface Props {
  pool: Pool;
}

const ActiveAuction = ({ pool }: Props) => {
  return (
    <Wrapper>
      <h3>{pool.name}</h3>
      <Description>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas euismod purus eget feugiat rutrum. Praesent at ante quis felis molestie mattis. Donec eget congue purus. Aenean pretium ex sed convallis tempus. Nam eros erat, cursus quis posuere eget, convallis blandit mi. Morbi vitae quam eget est elementum pretium.
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