import { format } from 'date-fns';
import styled from 'styled-components';

import { formatTemple } from 'components/Vault/utils';
import { Pool } from 'components/Layouts/Ascend/types';
import { UnstyledList } from 'styles/common';
import { usePoolTokenValues } from 'hooks/ascend';

interface Props {
  pool: Pool;
}

export const ChartInfoBar = ({ pool }: Props) => {
  const lastUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];
  const { formatted, label } = usePoolTokenValues(pool);

  return (
    <InfoBar>
      <InfoItem>
        <InfoLabel>Start Date</InfoLabel>
        <span>{format(lastUpdate.startTimestamp, 'LLL do K:mm aa')}</span>
      </InfoItem>
      <InfoItem>
        <InfoLabel>End Date</InfoLabel>
        <span>{format(lastUpdate.endTimestamp, 'LLL do K:mm aa')}</span>
      </InfoItem>
      <InfoItem>
        <InfoLabel>Pool Value</InfoLabel>
        <span>${formatTemple(pool.totalLiquidity)}</span>
      </InfoItem>
      <InfoItem>
        <InfoLabel>{label}</InfoLabel>
        <span>{formatted}</span>
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
