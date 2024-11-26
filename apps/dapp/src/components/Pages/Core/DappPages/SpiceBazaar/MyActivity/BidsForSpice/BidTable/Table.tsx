import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  epochId: number;
  auctionEndDateTime: string;
  bidAmount: number;
  claimableTokens: number | '-';
  unit: 'WSBI' | 'ENA';
  unitPrice: number | '-';
  claim: string;
  increase: string;
};

const data: Transaction[] = [
  {
    epochId: 1,
    auctionEndDateTime: '30.09.2024',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'WSBI',
    unitPrice: '-',
    claim: '',
    increase: '',
  },
  {
    epochId: 2,
    auctionEndDateTime: '14.10.2024',
    bidAmount: 100,
    claimableTokens: 100000,
    unit: 'WSBI',
    unitPrice: 231,
    claim: '',
    increase: '',
  },
  {
    epochId: 3,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 200000,
    unit: 'ENA',
    unitPrice: 99,
    claim: '',
    increase: '',
  },
  {
    epochId: 4,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 150000,
    unit: 'WSBI',
    unitPrice: 78,
    claim: '',
    increase: '',
  },
  {
    epochId: 5,
    auctionEndDateTime: '-',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'ENA',
    unitPrice: '-',
    claim: '',
    increase: '',
  },
];

export const BidHistory = () => {
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
