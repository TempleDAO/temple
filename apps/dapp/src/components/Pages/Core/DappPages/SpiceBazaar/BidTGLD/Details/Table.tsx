import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  epoch: number;
  status: 'Finished' | 'Started' | 'Scheduled' | 'Not yet started';
  auctionStartDate: string;
  auctionEndDate: string;
  amountTGLD: string;
  priceRatio: string;
};

const data: Transaction[] = [
  {
    epoch: 1,
    status: 'Finished',
    auctionStartDate: '2024-10-18 23:22:59 CST',
    auctionEndDate: '2024-10-13 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 DAI',
  },
  {
    epoch: 2,
    status: 'Finished',
    auctionStartDate: '2024-10-18 23:22:59 CST',
    auctionEndDate: '2024-09-18 23:22:59 CST',
    amountTGLD: '20,832.81 TGLD',
    priceRatio: '5.42 DAI',
  },
  {
    epoch: 3,
    status: 'Started',
    auctionStartDate: '2024-10-16 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 4,
    status: 'Started',
    auctionStartDate: '2024-10-14 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '18,000.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 5,
    status: 'Scheduled',
    auctionStartDate: '2024-09-15 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 6,
    status: 'Scheduled',
    auctionStartDate: '2024-09-15 23:22:59 CST',
    auctionEndDate: '-',
    amountTGLD: '22,500.00 TGLD',
    priceRatio: '-',
  },
  {
    epoch: 7,
    status: 'Not yet started',
    auctionStartDate: '-',
    auctionEndDate: '-',
    amountTGLD: '-',
    priceRatio: '-',
  },
  {
    epoch: 8,
    status: 'Not yet started',
    auctionStartDate: '-',
    auctionEndDate: '-',
    amountTGLD: '-',
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
