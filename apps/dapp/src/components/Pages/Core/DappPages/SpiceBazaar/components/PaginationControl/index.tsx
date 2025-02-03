import { Dispatch, SetStateAction } from 'react';
import styled from 'styled-components';
import { PageRangeSelector } from './PageRangeSelector';
import lastPage from 'assets/icons/last_page.svg?react';
import firstPage from 'assets/icons/first_page.svg?react';
import left from 'assets/icons/chevron_left.svg?react';
import right from 'assets/icons/chevron_right.svg?react';

type PaginationControlProps = {
  currentPage: number;
  totalPages: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
};

export const PaginationControl = (props: PaginationControlProps) => {
  const { totalPages, currentPage, setCurrentPage } = props;

  return (
    <PaginationContainer>
      <PageRangeSelector
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
      />
      <PageLink
        onClick={() => setCurrentPage((prev) => prev - 1)}
        disabled={currentPage === 1}
      >
        <LeftPageIcon />
      </PageLink>
      <PageLink
        onClick={() => setCurrentPage((prev) => prev + 1)}
        disabled={currentPage === totalPages}
      >
        <RightPageIcon />
      </PageLink>
      <PageLink onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
        <FirstPageIcon />
      </PageLink>
      <PageLink
        onClick={() => setCurrentPage(totalPages)}
        disabled={currentPage === totalPages}
      >
        <LastPageIcon />
      </PageLink>
    </PaginationContainer>
  );
};

const PaginationContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
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
  font-size: 16px;
  font-weight: 700;
  line-height: 19px;
  border: none;
  padding: 0;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  background: none;
  box-shadow: none;
  border-radius: 0px;
  display: flex;
  align-items: center;
  vertical-align: middle;
`;

const LeftPageIcon = styled(left)`
  width: 24px;
  height: 24px;
`;

const RightPageIcon = styled(right)`
  width: 24px;
  height: 24px;
`;

const FirstPageIcon = styled(firstPage)`
  width: 24px;
  height: 24px;
`;

const LastPageIcon = styled(lastPage)`
  width: 24px;
  height: 24px;
`;
