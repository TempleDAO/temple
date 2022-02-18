export const MOBILE_BREAKPOINT = '540px';

export const aboveMobileBreakpoint = (styles: string) => {
  return `
    @media (min-width: ${MOBILE_BREAKPOINT}) {
      ${styles}
    }
  `;
};
