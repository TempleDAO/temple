export const MOBILE_BREAKPOINT = '768px';

export const aboveMobileBreakpoint = (styles: string) => {
  return `
    @media (min-width: ${MOBILE_BREAKPOINT}) {
      ${styles}
    }
  `;
};
