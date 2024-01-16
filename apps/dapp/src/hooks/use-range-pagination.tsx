import { useMemo } from 'react';

/*
  Create an array of certain length and set the elements within it from
  start value to end value.
*/
const range = (start: number, end: number) => {
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

type Props = {
  totalPages: number;
  currentPage: number;
};
export const useRangePagination = (props: Props): number[] => {
  const { totalPages, currentPage } = props;
  const paginationRange = useMemo<Array<number>>(() => {
    /*
    Case 1:
    If the totalPages is less than 6, return the range [1..totalPages]
  */
    if (totalPages <= 6) {
      return range(1, totalPages);
    }

    /*
    Calculate left and right sibling index and make sure they are within range 1 and totalPages
  */
    const siblingCount = 1;
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    /*
    We do not show dots just when there is just one page number to be inserted 
    between the extremes of sibling and the page limits i.e 1 and totalPages. 
  */
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex <= totalPages - 2;

    // when range array has a -1, we will show dots
    const dots = -1;

    /*
    Case 2: No left dots to show, but rights dots to be shown
  */
    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, dots, totalPages];
    }

    /*
    Case 3: No right dots to show, but left dots to be shown
  */
    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(totalPages - rightItemCount + 1, totalPages);
      return [1, dots, ...rightRange];
    }

    /*
    Case 4: Both left and right dots to be shown
  */
    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [1, dots, ...middleRange, dots, totalPages];
    }

    return [];
  }, [totalPages, currentPage]);

  return paginationRange;
};
