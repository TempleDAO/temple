import { format } from 'date-fns';

import { useAuctionContext as useAscendContext } from 'components/Layouts/Ascend';
import { Pool } from 'components/Layouts/Ascend/types';
import { SwapHistory } from './components/SwapHistory';
import { Chart } from './components/Chart';
import { useTimeRemaining, usePoolSpotPrice } from './hooks';
import { Trade } from './components/Trade';
import { AuctionContextProvider, useAuctionContext } from './components/AuctionContext';
import { ChartInfoBar } from './components/ChartInfoBar';

import {
  ContractAddress,
  Description,
  ChartTradeSection,
} from './styles';

interface Props {
  pool: Pool;
}

const ActiveAuction = ({ pool }: Props) => {
  return (
    <div>
      <h3>{pool.name}</h3>
      <ContractAddress>
        {pool.address}
      </ContractAddress>
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
      <SwapHistory pool={pool} />
    </div>
  );
};

export const AscendPage = () => {
  const { pool } = useAscendContext();
  const timeRemaining = useTimeRemaining(pool);

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
