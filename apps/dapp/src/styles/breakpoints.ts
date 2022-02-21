import { css } from 'styled-components';

export const aboveTabletBreakpoint = (styles: string) => {
  return css`
    @media screen and (min-width: ${({ theme }) => theme.metrics.devices.tablet}) {
      ${styles}
    }
  `;
};