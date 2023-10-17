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

      <PageLink selected onClick={() => setCurrentPage(1)}>
        First
      </PageLink>
      <PageLink selected onClick={() => setCurrentPage((prev) => prev - 1)} disabled={currentPage === 1}>
        Prev
      </PageLink>
      <PageLink selected onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage === totalPages}>
        Next
      </PageLink>
      <PageLink selected onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
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
  color: ${({ selected, theme }) => (selected ? theme.palette.brand : theme.palette.brandLight)};
  border: none;
  padding: 0;
  cursor: pointer;
  background: none;
  box-shadow: none;
  border-radius: 0px;
`;

const PaginationContainer = styled.div`
  text-align: right;
  margin: 10px 0;
`;
