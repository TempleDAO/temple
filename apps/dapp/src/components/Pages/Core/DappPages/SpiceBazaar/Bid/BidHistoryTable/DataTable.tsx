import React, { useState } from 'react';
import styled from 'styled-components';
import { Bid } from '../hooks/use-bids-history';
import { PaginationControl } from 'components/Pages/Core/DappPages/SpiceBazaar/components/PaginationControl';
import * as breakpoints from 'styles/breakpoints';
import env from 'constants/env';
import { ScrollBar } from 'components/Pages/Core/DappPages/SpiceBazaar/components/CustomScrollBar';

enum TableHeaders {
  Date = 'Date',
  BidAmount = 'Bid Amount',
  Price = 'Price',
  Transaction = 'Transaction',
}

type TableProps = {
  bids: Bid[];
  loading: boolean;
  refetch?: () => void;
  dataRefetching?: boolean;
};

const ROWS_PER_PAGE = 5;

export const DataTable: React.FC<TableProps> = ({ bids, loading }) => {
  const tableHeaders = [
    { name: TableHeaders.Date },
    { name: TableHeaders.BidAmount },
    { name: TableHeaders.Price },
    { name: TableHeaders.Transaction },
  ];

  const [currentPage, setCurrentPage] = useState(1);

  const sortedBids = [...bids].sort((a, b) => Number(b.date) - Number(a.date));

  const indexOfLastBid = currentPage * ROWS_PER_PAGE;
  const indexOfFirstBid = indexOfLastBid - ROWS_PER_PAGE;
  const currentBids = sortedBids.slice(indexOfFirstBid, indexOfLastBid);

  const totalPages = Math.ceil(bids.length / ROWS_PER_PAGE);

  return (
    <PageContainer>
      <Header>
        <Title>BID HISTORY</Title>
      </Header>
      <ScrollBar autoHide={false}>
        <TableData>
          <thead>
            <HeaderRow>
              {tableHeaders.map((h) => (
                <TableHeader key={h.name}>{h.name}</TableHeader>
              ))}
            </HeaderRow>
          </thead>
          <tbody>
            {loading ? (
              <DataRow>
                <DataCell colSpan={6}>Loading...</DataCell>
              </DataRow>
            ) : currentBids.length === 0 ? (
              <DataRow>
                <DataCell colSpan={6}>No data available</DataCell>
              </DataRow>
            ) : (
              currentBids.map((b) => (
                <DataRow key={b.transaction}>
                  <DataCell>
                    {new Date(Number(b.date) * 1000).toLocaleDateString(
                      'en-GB'
                    )}
                  </DataCell>
                  <DataCell>{b.bidAmount}</DataCell>
                  <DataCell>{parseFloat(b.price).toFixed(6)}</DataCell>
                  <DataCell>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`${env.etherscan}/tx/${b.transactionHash}`}
                    >
                      {b.transaction}
                    </a>
                  </DataCell>
                </DataRow>
              ))
            )}
          </tbody>
        </TableData>
      </ScrollBar>
      <PaginationControl
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 10px;
  `)}
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const Title = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 16px;
  line-height: 19px;
  margin-left: 5px;

  ${breakpoints.phoneAndAbove(`
    margin-left: 20px;
  `)}
`;

const TableData = styled.table`
  border-spacing: 10px;
  min-width: 600px;
  border-collapse: collapse;
  width: 100%;
`;

const HeaderRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TableHeader = styled.th`
  padding: 20px 16px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding-top: 5px;
  color: ${({ theme }) => theme.palette.brand};
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DataRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  text-align: left;
  padding: 20px 16px;
  width: 33.33%;
  color: ${({ theme }) => theme.palette.brandLight};

  a {
    color: ${({ theme }) => theme.palette.brandLight};
  }

  a:hover {
    color: ${({ theme }) => theme.palette.brand};
  }
`;
