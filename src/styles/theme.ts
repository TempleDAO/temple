import { darken, transparentize } from 'polished';
import { css, DefaultTheme, keyframes } from 'styled-components';

/**
 * Helper to create css transitions
 * @param property => the css property to use for the transition
 */
const makeTransition = (property: string): string => {
  const DEFAULT_TRANSITION_DURATION = '250ms';
  const DEFAULT_TRANSITION_TF = 'ease-in';
  return `${property} ${DEFAULT_TRANSITION_DURATION} ${DEFAULT_TRANSITION_TF}`;
};

/* TODO: Check font stack with designers */
const fontHeading = `font-family: Megant, serif;`;
const fontBody = `font-family: Caviar Dreams, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;`;

const brandColor = '#BD7B4F';
const darkColor = '#0C0B0B';

const spinKeyframe = keyframes`
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
`;

const theme: DefaultTheme = {
  palette: {
    brand: brandColor,
    brand75: transparentize(0.25, brandColor),
    brand50: transparentize(0.50, brandColor),
    brand25: transparentize(0.75, brandColor),
    dark: darkColor,
    dark75: transparentize(0.25, darkColor),
    light: '#FFFFFF',
    light50: darken(0.50, '#FFFFFF'),
  },
  metrics: {
    headerHeight: '5rem'  /* 80/16 */,
    desktop: {
      maxWidth: '72rem'  /* 1152/16 */
    },
    devices: {
      tablet: '64rem',
      laptop: '90rem  /* 1440/16 */',
    }
  },
  typography: {
    fonts: {
      fontHeading,
      fontBody,
    },
    h1: css`
      ${fontHeading};
      font-size: 3rem /* 48/16 */;
    `,
    h2: css`
      ${fontHeading};
      font-size: 2.25rem /* 36/16 */;
    `,
    h3: css`
      ${fontHeading};
      font-size: 1.75rem /* 28/16 */;
    `,
    h4: css`
      ${fontBody};
      font-size: 1.5rem /* 24/16 */;
    `,
    body: css`
      ${fontBody};
      font-size: 1rem /* 14/16 */;
    `,
    meta: css`
      ${fontBody};
      font-size: 0.875rem /* 14/16 */;
      font-weight: 700;
    `
  },
  transitions: {
    color: makeTransition('color'),
    backgroundColor: makeTransition('background-color')
  },
  animations: {
    spin: css`${spinKeyframe} 60000ms linear infinite`,
    loading: css`${spinKeyframe} 1500ms cubic-bezier(0.84, -0.49, 0.18, 1.36) infinite`,
  },
  shadows: {
    base: `0px 4px 24px ${transparentize(0.75, brandColor)}`
  },
  zIndexes: {
    below: -1,
    base: 0,
    up: 1,
    top: 10,
  }
};

export { theme };
