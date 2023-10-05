import { useEffect, useState } from 'react';
import styled from 'styled-components';

type TableRow = {
  date: string;
  debit: number;
  credit: number;
};

type Props = {
  filter: string;
};

const TxnHistoryTable = ({ filter }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [data, setData] = useState<TableRow[]>([]);

  const lastRow = currentPage * rowsPerPage;
  const firstRow = lastRow - rowsPerPage;
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const currentData = data.slice(firstRow, lastRow);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Replace with your API endpoint
        // const response = await fetch('https://api.yourdomain.com/data-endpoint');
        // const result = await response.json();

        // setData(result.data);
        // TODO: USE filter
        console.log('filter', filter);
        setData(
          new Array(100).fill(100).map((e, i) => {
            return {
              date: '2021-09-01',
              debit: i,
              credit: 100,
            };
          })
        );
      } catch (error) {
        console.error('Error fetching data: ', error);
        // Handle error appropriately
      }
    };
    fetchData();
  }, [filter]);

  return (
    <TableContainer>
      <PaginationControls>
        {[...Array(totalPages)].map((_, index) => (
          <PageLink
            selected={currentPage === index + 1}
            key={index}
            onClick={() => setCurrentPage(index + 1)}
            disabled={currentPage === index + 1}
          >
            {index + 1}
          </PageLink>
        ))}

        <PageLink selected onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
          First
        </PageLink>
        <PageLink selected onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
          Prev
        </PageLink>
        <PageLink
          selected
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </PageLink>
        <PageLink selected onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
          Last
        </PageLink>
      </PaginationControls>

      <DataTable>
        <thead>
          <tr>
            <TableHeader>Date</TableHeader>
            <TableHeader>Debit</TableHeader>
            <TableHeader>Credit</TableHeader>
          </tr>
        </thead>
        <tbody>
          {currentData.map((row, index) => (
            <DataRow key={index}>
              <DataCell>{row.date}</DataCell>
              <DataCell>{row.debit}</DataCell>
              <DataCell>{row.credit}</DataCell>
            </DataRow>
          ))}
        </tbody>
      </DataTable>
    </TableContainer>
  );
};

export default TxnHistoryTable;

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 70vw;
`;

type PageLinkProps = {
  selected?: boolean;
};

const PageLink = styled.button<PageLinkProps>`
  margin: 0 5px;
  color: ${({ selected, theme }) => (selected ? theme.palette.brand : theme.palette.brandLight)};
  border: none;
  padding: 0;
  cursor: pointer;
  background: none;
  box-shadow: none;
  border-radius: 0px;
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 8px;
`;

const DataTable = styled.table`
  border-collapse: collapse;
  color: ${({ theme }) => theme.palette.brand};
`;

const DataRow = styled.tr`
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const DataCell = styled.td`
  padding: 8px;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const PaginationControls = styled.div`
  text-align: right;
  margin: 10px 0;
`;
