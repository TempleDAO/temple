import { Dispatch, SetStateAction } from 'react';
import styled from 'styled-components';

export type PaginationControlProps = {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
};

export const PaginationControls = (props: PaginationControlProps) => {
  const { totalPages, currentPage, rowsPerPage, setCurrentPage } = props;

  return (
    <PaginationContainer>
      {[...Array(totalPages)].map((_, index) => <PageLink
          selected={currentPage === index + 1}
          key={index + 1}
          onClick={() => setCurrentPage(index + 1)}
          disabled={currentPage === index + 1}
        >
          {index + 1}
        </PageLink>)}

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
