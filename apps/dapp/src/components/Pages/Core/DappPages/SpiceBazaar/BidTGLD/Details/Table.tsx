import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  epoch: number;
  status: 'Closed' | 'Active' | 'Upcoming';
  auctionStartDate: string;
  auctionEndDate: string;
  amountTGLD: string;
  priceRatio: string;
};

const data: Transaction[] = [
  {
    epoch: 1,
    status: 'Closed',
    auctionStartDate: '2024-10-18 23:22:59 CST',
    auctionEndDate: '2024-10-13 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 USDS',
  },
  {
    epoch: 2,
    status: 'Closed',
    auctionStartDate: '2024-10-18 23:22:59 CST',
    auctionEndDate: '2024-09-18 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 USDS',
  },
  {
    epoch: 3,
    status: 'Active',
    auctionStartDate: '2024-10-16 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 4,
    status: 'Active',
    auctionStartDate: '2024-10-14 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 5,
    status: 'Upcoming',
    auctionStartDate: '2024-09-15 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 6,
    status: 'Upcoming',
    auctionStartDate: '2024-09-15 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
];

export const AuctionsHistory = () => {
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
