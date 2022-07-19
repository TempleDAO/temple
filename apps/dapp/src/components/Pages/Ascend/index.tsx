import { format } from 'date-fns';

import { useAuctionContext } from 'components/Layouts/Ascend';
import { formatBigNumber } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { SwapHistory } from './components/SwapHistory';
import { Chart } from './components/Chart';
import { useTimeRemaining } from './hooks';
import { Trade } from './components/Trade';

import {
  ContractAddress,
  InfoBar,
  InfoItem,
  InfoLabel,
  Description,
  ChartTradeSection,
} from './styles';

interface Props {
  pool: Pool;
}

const ActiveAuction = ({ pool }: Props) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];

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
          <InfoBar>
            <InfoItem>
              <InfoLabel>
                Start Date
              </InfoLabel>
              <span>{format(lastUpdate.startTimestamp, 'LLL do')}</span>
            </InfoItem>
            <InfoItem>
              <InfoLabel>
                End Date
              </InfoLabel>
              <span>{format(lastUpdate.endTimestamp, 'LLL do')}</span>
            </InfoItem>
            <InfoItem>
              <InfoLabel>
                TVL
              </InfoLabel>
              <span>${formatNumber(formatBigNumber(pool.totalLiquidity))}</span>
            </InfoItem>
            <InfoItem>
              <InfoLabel>
                Current Price
              </InfoLabel>
              <span>${formatNumber(formatBigNumber(pool.totalLiquidity))}</span>
            </InfoItem>
          </InfoBar>
          <Chart pool={pool} />
        </div>
        <Trade pool={pool} />
      </ChartTradeSection>
      <SwapHistory pool={pool} />
    </div>
  );
};

export const AscendPage = () => {
  const { pool } = useAuctionContext();
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
    <ActiveAuction pool={pool} />
  );
};
