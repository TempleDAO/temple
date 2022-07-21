import { format } from 'date-fns';
import styled from 'styled-components';

import { formatBigNumber, formatTemple } from 'components/Vault/utils';
import { formatNumber } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { UnstyledList } from 'styles/common';
import { usePoolTokenValues } from 'hooks/ascend';
import { CircularLoader } from 'components/Loader/CircularLoader';
import { ZERO } from 'utils/bigNumber';

interface Props {
  pool: Pool;
}

export const ChartInfoBar = ({ pool }: Props) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const { spotPrice, totalLiquidity, isLoading } = usePoolTokenValues(pool);

  return (
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
        <span>{isLoading ? <CircularLoader /> : <>${formatTemple(totalLiquidity || ZERO)}</>}</span>
      </InfoItem>
      <InfoItem>
        <InfoLabel>
          Current Price
        </InfoLabel>
        <span>{isLoading ? <CircularLoader /> : <>${formatNumber(formatBigNumber(spotPrice || ZERO))}</>}</span>
      </InfoItem>
    </InfoBar>
  );
};

export const InfoBar = styled(UnstyledList)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  margin: 0 0 0.5rem;
`;

export const InfoItem = styled.li`
  ${({ theme }) => theme.typography.body}
  display: flex;
  flex-direction: column;
  padding: 1rem;
`;

export const InfoLabel = styled.span`
  font-weight: 700;
  text-transform: uppercase;
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
`;
