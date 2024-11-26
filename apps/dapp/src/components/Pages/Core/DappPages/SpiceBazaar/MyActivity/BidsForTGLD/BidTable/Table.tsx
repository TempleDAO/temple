import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  epochId: number;
  auctionEndDateTime: string;
  bidAmount: number;
  claimableTokens: number | '-';
  unit: 'TGLD';
  unitPrice: number;
  claim: string;
  increase: string;
};

const data: Transaction[] = [
  {
    epochId: 1,
    auctionEndDateTime: '30.09.2024',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'TGLD',
    unitPrice: 0.0025,
    claim: '',
    increase: '',
  },
  {
    epochId: 2,
    auctionEndDateTime: '14.10.2024',
    bidAmount: 100,
    claimableTokens: 100000,
    unit: 'TGLD',
    unitPrice: 0.0029,
    claim: '',
    increase: '',
  },
  {
    epochId: 3,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 200000,
    unit: 'TGLD',
    unitPrice: 0.0025,
    claim: '',
    increase: '',
  },
  {
    epochId: 4,
    auctionEndDateTime: '28.10.2024',
    bidAmount: 100,
    claimableTokens: 150000,
    unit: 'TGLD',
    unitPrice: 0.0045,
    claim: '',
    increase: '',
  },
  {
    epochId: 5,
    auctionEndDateTime: '-',
    bidAmount: 100,
    claimableTokens: '-',
    unit: 'TGLD',
    unitPrice: 0.0029,
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
