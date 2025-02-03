import styled from 'styled-components';
import { DataTable } from './DataTable';

export type Transaction = {
  status: string;
  auctionName: string;
  totalVolume: number;
  floorPrice: number;
  bestOffer: number;
  details: string;
  bid: string;
};

const data: Transaction[] = [
  {
    status: 'Upcoming 2024-11-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Upcoming 2024-11-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Upcoming 2024-10-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Upcoming 2024-10-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Ends in 00:15:03:04 at 2024-10-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Closed at 2024-10-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
  },
  {
    status: 'Closed at 2024-10-13 23:22:59 CST',
    auctionName: 'Spice 1',
    totalVolume: 1848,
    floorPrice: 0.1097,
    bestOffer: 0.0819,
    details: 'details',
    bid: '',
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
