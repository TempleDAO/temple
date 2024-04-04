import styled from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';

export const PageWrapper = styled.div`
  padding: 0 1rem;
`;

export const ContractAddress = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.75rem;
  margin: -1rem 0 1rem;
`;

export const Description = styled.p`
  margin-bottom: 2.5rem;
  max-width: 48rem;
`;

export const ChartTradeSection = styled.div`
  display: grid;

  ${tabletAndAbove(`
    grid-template-columns: 2fr 1fr;
    grid-column-gap: 1.25rem;
  `)}
`;

export const TradeWrapper = styled.div`
  padding: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 1rem;
  background: #1d1a1a;
`;

export const TradeHeader = styled.h3`
  margin: 0 0 1rem;
`;
