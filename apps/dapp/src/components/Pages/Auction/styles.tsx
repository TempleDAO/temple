import styled from 'styled-components';

import { UnstyledList } from 'styles/common';

export const ContractAddress = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: .75rem;
  margin: -1rem 0 1rem;
`;

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
  margin-bottom: .25rem;
  font-size: 0.875rem;
`;

export const Description = styled.p`
  margin-bottom: 2.5rem;
  max-width: 48rem;
`;

export const ChartTradeSection = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-column-gap: 0.4375rem;
`;

export const TradeWrapper = styled.div`
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 1rem;
  background: #1D1A1A;
`;
