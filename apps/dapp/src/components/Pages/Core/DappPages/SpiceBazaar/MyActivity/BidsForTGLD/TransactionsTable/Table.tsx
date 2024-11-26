import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  epoch: string;
  type: 'Bid' | 'Claim';
  transactionLink: string;
};

const data: Transaction[] = [
  {
    epoch: '12/12/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/12/2024',
    type: 'Claim',
    transactionLink: '0x342c4535430979a...0b6b8b25',
  },
  {
    epoch: '12/12/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/12/2024',
    type: 'Bid',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
  {
    epoch: '12/12/2024',
    type: 'Claim',
    transactionLink: '0x192c453a2dbb0b...0e74a056',
  },
];

export const TransactionsHistory = () => {
  return (
    <AuctionsHistoryContainer>
      <DataTable transactions={data} loading={false} />
    </AuctionsHistoryContainer>
  );
};

const AuctionsHistoryContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
