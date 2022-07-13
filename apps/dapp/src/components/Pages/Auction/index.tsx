import { useState, useEffect } from 'react';
import { formatDistanceStrict, formatDuration, format, intervalToDuration } from 'date-fns';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, HorizontalGridLines, VerticalGridLines} from 'react-vis';

import { useAuctionContext } from 'components/Layouts/Auction';
import { UnstyledList } from 'styles/common';
import { formatBigNumber } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import { theme } from 'styles/theme';
import env from 'constants/env';
import { CenterScreenWrapper } from 'components/Pages/Core/styles';
import { SwapHistory } from './components/SwapHistory';
import { AuctionChart } from './components/AuctionChart';
import { useTimeRemaining } from './utils';
import { Input } from 'components/Input/Input';

import {
  PageWrapper,
  ContractAddress,
  InfoBar,
  InfoItem,
  InfoLabel,
  Description,
  ChartTradeSection,
  TradeWrapper,
} from './styles';

const ActiveAuction = ({ pool }: { pool: Pool }) => {
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
          <AuctionChart pool={pool} />
        </div>
        <TradeWrapper>
          <h3>Trade TEMPLE</h3>
          <Input />
          <Input />
        </TradeWrapper>
      </ChartTradeSection>
      <SwapHistory pool={pool} />
    </div>
  );
};

export const AuctionPage = () => {
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
