import { css } from 'styled-components';

export const MOBILE_BREAKPOINT = '768px';

export const aboveMobileBreakpoint = (styles: string) => {
  return css`
    @media (min-width: ${MOBILE_BREAKPOINT}) {
      ${styles}
    }
  `;
};16