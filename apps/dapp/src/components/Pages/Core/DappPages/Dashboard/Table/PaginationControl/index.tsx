import { Dispatch, SetStateAction } from 'react';
import styled from 'styled-components';
import { PageRangeSelector } from './PageRangeSelector';
import {
  InputSelect,
  SelectTempleDaoOptions,
  Option,
} from 'components/InputSelect/InputSelect';

type PaginationControlProps = {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setRowsPerPage: Dispatch<SetStateAction<number>>;
};

const dropdownOptions: SelectTempleDaoOptions = [
  { label: '5 rows', value: 5 },
  { label: '10 rows', value: 10 },
  { label: '20 rows', value: 20 },
  { label: '50 rows', value: 50 },
  { label: '100 rows', value: 100 },
];

export const PaginationControl = (props: PaginationControlProps) => {
  const {
    totalPages,
    currentPage,
    rowsPerPage,
    setCurrentPage,
    setRowsPerPage,
  } = props;

  return (
    <PaginationContainer>
      <PageRangeSelector
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />
      <PageLink onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
        First
      </PageLink>
      <PageLink
        onClick={() => setCurrentPage((prev) => prev - 1)}
        disabled={currentPage === 1}
      >
        Prev
      </PageLink>
      <PageLink
        onClick={() => setCurrentPage((prev) => prev + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </PageLink>
      <PageLink
        onClick={() => setCurrentPage(totalPages)}
        disabled={currentPage === totalPages}
      >
        Last
      </PageLink>
      <InputSelect
        onChange={(e: Option) => setRowsPerPage(Number(e.value))}
        options={dropdownOptions}
        defaultValue={dropdownOptions.find((o) => o.value === rowsPerPage)}
        width="6rem"
        fontSize="0.68rem"
        zIndex={5} // place it above table filter dropdowns when they overlap on mobile
      />
    </PaginationContainer>
  );
};

const PaginationContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  margin: 10px 0;
`;

type PageLinkProps = {
  selected?: boolean;
  disabled?: boolean;
};

export const PageLink = styled.button<PageLinkProps>`
  margin: 0 5px;
  color: ${({ selected, disabled, theme }) =>
    disabled
      ? theme.palette.brand50
      : selected
      ? theme.palette.brandLight
      : theme.palette.brand};
  border: none;
  padding: 0;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  background: none;
  box-shadow: none;
  border-radius: 0px;
`;
