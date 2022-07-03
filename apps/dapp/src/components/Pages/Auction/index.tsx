import { Link } from 'react-router-dom';
import { formatDistanceStrict, format } from 'date-fns';
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
            {x: timestamp + MSEC_DAILY * 7, y: 4},
            {x: timestamp + MSEC_DAILY * 8, y: 3},
          ]}
        />
      </FlexibleXYPlot>
    </div>
  );
};

export const AuctionPage = () => {
  const { pool } = useAuctionContext();

  if (!pool) {
    return <>Coming Soon...</>;
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
