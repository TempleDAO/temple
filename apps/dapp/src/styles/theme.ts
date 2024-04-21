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
  // Pallete is in sync with Figma TempleDAO SD => https://www.figma.com/file/UA58EtNIjomjY9maDMCPtH/TempleDAO-DS
  palette: {
    black: '#0B0A0A',
    brand: brandColor,
    brandLight: '#FFDEC9',
    brandDark: '#95613F',
    brandDarker: '#351F11',
    brand75: transparentize(0.25, brandColor),
    brand50: transparentize(0.5, brandColor),
    brand25: transparentize(0.75, brandColor),
    dark: darkColor,
    dark75: transparentize(0.25, darkColor),
    // check if this color is needed? If it is then need to sync to Figma
    grayOpaque: '#1B1919',
    light: '#FFFFFF',
    light75: darken(0.25, '#FFFFFF'),
    light50: darken(0.5, '#FFFFFF'),
    // https://www.figma.com/file/fZ7bvpavsMdADJjsk7QIsw/Temple-Core?type=design&node-id=4901-16456&mode=design&t=ctnue8yba6NEWJ1c-0
    charts: [
      '#D0BE75',
      '#FFDEC9',
      '#BD7B4F',
      '#00846B',
      '#876FAC',
      '#AF444A',
      '#24809D',
      '#9D2498',
      '#9D4124',
      '#9D7424',
      '#588F22',
      '#26249D',
    ],
    enclave: {
      structure: '#01806C',
      order: '#BBAA6C',
      chaos: '#AD2D47',
      mystery: '#8E76B0',
      logic: '#226697',
    },
    gradients: {
      dark: 'linear-gradient(180deg, #353535 45.25%, #101010 87.55%)',
      grey: 'linear-gradient(90deg, rgba(196, 196, 196, 0) 0.49%, rgba(89, 89, 89, 0.48) 50.04%, rgba(196, 196, 196, 0) 100%)',
      greyVertical:
        'var(--gradient-light-vertical, linear-gradient(180deg, #353535 45.25%, #101010 81.46%, #0B0A0A 87.55%))',
    },
  },
  metrics: {
    headerHeight: '5rem' /* 80/16 */,
    desktop: {
      minWidth: '64rem' /* 1024/16 */,
      maxWidth: '72rem' /* 1152/16 */,
    },
    devices: {
      smallTablet: '50rem' /* 800/16 */,
      tablet: '64rem' /* 1024/16 */,
      laptop: '90rem' /* 1440/16 */,
      phone: '37.5rem' /* 600/16 */,
    },
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
    `,
  },
  transitions: {
    color: makeTransition('color'),
    backgroundColor: makeTransition('background-color'),
  },
  animations: {
    spin: css`
      ${spinKeyframe} 60000ms linear infinite
    `,
    loading: css`
      ${spinKeyframe} 1500ms cubic-bezier(0.84, -0.49, 0.18, 1.36) infinite
    `,
  },
  shadows: {
    base: `0px 4px 24px ${transparentize(0.75, brandColor)}`,
  },
  zIndexes: {
    below: -1,
    base: 0,
    up: 1,
    top: 10,
    max: 101,
  },
};

export { theme };
