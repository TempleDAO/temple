import { Dispatch, SetStateAction } from 'react';
import { useRangePagination } from 'hooks/use-range-pagination';
import { PageLink } from '.';
import styled from 'styled-components';

type Props = {
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
};

export const PageRangeSelector = (props: Props) => {
  const { setCurrentPage, totalPages, currentPage } = props;

  const paginationRange = useRangePagination({
    currentPage,
    totalPages,
  });

  if (!paginationRange) return null;

  if (currentPage === 0 || paginationRange.length < 2) {
    return null;
  }

  return (
    <>
      {paginationRange.map((pageNumber, i) => {
        if (pageNumber === -1)
          return <DotsContainer key={i + 'dots'}>...</DotsContainer>;
        return (
          <PageLink
            key={pageNumber}
            onClick={() => setCurrentPage(pageNumber)}
            selected={currentPage === pageNumber}
          >
            {pageNumber}
          </PageLink>
        );
      })}
    </>
  );
};

const DotsContainer = styled.div`
   {
    margin: 2px 5px;
    color: ${({ theme }) => theme.palette.brand};
  }
`;
