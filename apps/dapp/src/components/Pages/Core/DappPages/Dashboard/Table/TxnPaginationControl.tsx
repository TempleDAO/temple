import { Dispatch, SetStateAction } from 'react';
import styled, { css } from 'styled-components';

type PaginationControlProps = {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setRowsPerPage: Dispatch<SetStateAction<number>>;
};

type DropdownOptionsType = { value: number; label: string };

export const PaginationControls = (props: PaginationControlProps) => {
  const { totalPages, currentPage, rowsPerPage, setCurrentPage, setRowsPerPage } = props;
  const dropdownOptions: DropdownOptionsType[] = [
    { label: '5 rows', value: 5 },
    { label: '10 rows', value: 10 },
    { label: '20 rows', value: 20 },
    { label: '50 rows', value: 50 },
    { label: '100 rows', value: 100 },
  ];

  // console.log('option filtered', dropdownOptions.filter(v=> v.value===rowsPerPage)[0]);

  return (
    <PaginationContainer>
      {[...Array(totalPages)].map((_, index) => (
        <PageLink
          selected={currentPage === index + 1}
          key={index + 1}
          onClick={() => setCurrentPage(index + 1)}
          disabled={currentPage === index + 1}
        >
          {index + 1}
        </PageLink>
      ))}

      <PageLink onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
        First
      </PageLink>
      <PageLink onClick={() => setCurrentPage((prev) => prev - 1)} disabled={currentPage === 1}>
        Prev
      </PageLink>
      <PageLink onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage === totalPages}>
        Next
      </PageLink>
      <PageLink onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
        Last
      </PageLink>
      <PageLink>
        <Select 
          value={dropdownOptions.filter((v) => v.value === rowsPerPage)[0].value} 
          onChange={(e) => setRowsPerPage(Number(e.currentTarget.value))}>
          {dropdownOptions.map(o=>(
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </PageLink>
    </PaginationContainer>
  );
};

type PageLinkProps = {
  selected?: boolean;
};

const PageLink = styled.button<PageLinkProps>`
  margin: 0 5px;
  color: ${({ selected, theme }) => (selected ? theme.palette.brandLight : theme.palette.brand)};
  border: none;
  padding: 0;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  background: none;
  box-shadow: none;
  border-radius: 0px;
`;

const PaginationContainer = styled.div`
  text-align: right;
  margin: 10px 0;
`;

const Select = styled.select`
  ${({ theme }) => theme.typography.body}
  border: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 0.2rem;
  background: none;
  color: #fff;
  font-size: 0.8rem;
`;