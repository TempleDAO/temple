import { useState, useEffect } from 'react';
import { formatDistanceStrict, formatDuration, format, intervalToDuration } from 'date-fns';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, HorizontalGridLines} from 'react-vis';
import styled from 'styled-components';
import { curveNatural } from 'd3-shape';

import { useAuctionContext } from 'components/Layouts/Auction';
import { UnstyledList } from 'styles/common';
import { formatBigNumber } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { Pool } from 'components/Layouts/Auction/types';
import { theme } from 'styles/theme';

const MSEC_DAILY = 86400000;

const ActiveAuction = ({ pool }: { pool: Pool }) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const duration = formatDistanceStrict(lastUpdate.startTimestamp, lastUpdate.endTimestamp);

  const timestamp = new Date('September 9 2017').getTime();

  return (
    <div>
      <h3>{pool.name}</h3>
      <ContractAddress>
        {pool.address}
      </ContractAddress>
      <InfoBar>
        <InfoItem>
          <InfoLabel>
            Duration
          </InfoLabel>
          <span>
            {duration}
          </span>
          start: {format(lastUpdate.startTimestamp, 'LLL d, y, h:mm aa')}<br/>
          end: {format(lastUpdate.endTimestamp, 'LLL d, y, h:mm aa')}
        </InfoItem>
        <InfoItem>
          <InfoLabel>
            Ended
          </InfoLabel>
        </InfoItem>
        <InfoItem>
          <InfoLabel>
            Total Volume
          </InfoLabel>
          <span>${formatNumber(formatBigNumber(pool.totalSwapVolume))}</span>
        </InfoItem>
        <InfoItem>
          <InfoLabel>
            Liquidity
          </InfoLabel>
          <span>${formatNumber(formatBigNumber(pool.totalLiquidity))}</span>
        </InfoItem>
        <InfoItem>
          <InfoLabel>
            Price
          </InfoLabel>
          {/* <span>${formatNumber(formatBigNumber(pool.totalLiquidity))}</span> */}
          <span>*TBD Live Price</span>
        </InfoItem>
      </InfoBar>
     
      <FlexibleXYPlot xType="time" height={300}>
        <HorizontalGridLines />
        <XAxis />
        <YAxis />
        <LineSeries
          color={theme.palette.brand}
          curve={curveNatural}
          data={[
            {x: timestamp + MSEC_DAILY, y: 10},
            {x: timestamp + MSEC_DAILY * 2, y: 8},
            {x: timestamp + MSEC_DAILY * 3, y: 7},
            {x: timestamp + MSEC_DAILY * 4, y: 8},
            {x: timestamp + MSEC_DAILY * 5, y: 5},
            {x: timestamp + MSEC_DAILY * 6, y: 7},
            {x: timestamp + MSEC_DAILY * 9, y: 7},
            {x: timestamp + MSEC_DAILY * 15, y: 4},
          ]}
        />
      </FlexibleXYPlot>
    </div>
  );
};

interface Props {
  pool: Pool;
  timeRemaining: string;
}

const FutureAuction = ({ pool, timeRemaining }: Props) => {
  return (
    <>
      <h2>
        {pool.name}
      </h2>
      <h3>Launching in: {timeRemaining}</h3>
    </>
  );
};

const b = Date.now() + (1000 * 10)

const useTimeRemaining = (pool?: Pool) => {
  const getRemainingTime = (pool?: Pool) => {
    const weights = pool?.weightUpdates || [];
    const lastUpdate = weights[weights.length - 1];
    const startTime = lastUpdate ? lastUpdate.startTimestamp : null;
    const now = Date.now();

    if (!startTime) {
      return '';
    }


    if (now >= startTime.getTime()) {
      return '';
    }

    const duration = intervalToDuration({
      start: now,
      end: startTime,
    });

    return formatDuration(duration, {
      delimiter: ', ',
      format: ['months', 'weeks', 'days', 'hours', 'seconds'],
    });
  };

  const [time, setTime] = useState(getRemainingTime(pool));

  useEffect(() => {
    if (!pool || !time) {
      return;
    }

    const id = setTimeout(() => {
      setTime(getRemainingTime(pool));
    }, 1000);

    return () => {
      clearTimeout(id);
    };
  }, [setTime, pool, time]);

  return time;
};

export const AuctionPage = () => {
  const { pool } = useAuctionContext();
  const timeRemaining = useTimeRemaining(pool);

  if (!pool) {
    return <>Coming Soon...</>;
  }

  if (timeRemaining) {
    // starting in the future
    // show countdown
    return (
      <FutureAuction pool={pool} timeRemaining={timeRemaining} />
    );
  }

  return <ActiveAuction pool={pool} />;
};

const ContractAddress = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: .75rem;
  margin: -1rem 0 1rem;
`;

const InfoBar = styled(UnstyledList)`
  display: inline-flex;
  flex-direction: row;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};
  border-radius: 1.25rem;
  margin: 0 0 1rem;
`;

const InfoItem = styled.li`
  ${({ theme }) => theme.typography.body}
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-right: 1px solid ${({ theme }) => theme.palette.brand};

  &:last-of-type {
    border-right: none;
  }
`;

const InfoLabel = styled.span`
  color: ${({ theme }) => theme.palette.brand};
  font-weight: 600;
  display: block;
  margin-bottom: .25rem;
`;
