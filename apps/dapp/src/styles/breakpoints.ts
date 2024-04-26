import { toQuery } from 'react-responsive';
import {
  css,
  FlattenInterpolation,
  ThemeProps,
  DefaultTheme,
} from 'styled-components';
import { theme } from 'styles/theme';

type Css = FlattenInterpolation<ThemeProps<DefaultTheme>>;

export const tabletAndAbove = (styles: string | Css) => {
  return css`
    @media screen and (min-width: ${({ theme }) =>
        theme.metrics.devices.tablet}) {
      ${styles}
    }
  `;
};

export const phoneAndAbove = (styles: string | Css) => {
  return css`
    @media screen and (min-width: ${({ theme }) =>
        theme.metrics.devices.phone}) {
      ${styles}
    }
  `;
};

export const verySmallDesktop = (styles: string | Css) => {
  return css`
    @media screen and ${queryVerySmallDesktop} {
      ${styles}
    }
  `;
};

export const phoneToSmallTablet = (styles: string | Css) => {
  return css`
    @media screen and ${queryPhoneToSmallTablet} {
      ${styles}
    }
  `;
};

export const phoneToTablet = (styles: string | Css) => {
  return css`
    @media screen and ${queryPhoneToTablet} {
      ${styles}
    }
  `;
};

export const smallTabletToTablet = (styles: string | Css) => {
  return css`
    @media screen and ${querySmalTabletToTablet} {
      ${styles}
    }
  `;
};

export const tabletToDesktop = (styles: string | Css) => {
  return css`
    @media screen and ${queryTabletToDesktop} {
      ${styles}
    }
  `;
};

export const minTablet = (styles: string | Css) => {
  return css`
    @media screen and ${queryMinTablet} {
      ${styles}
    }
  `;
};

export const phone = (styles: string | Css) => {
  return css`
    @media screen and (max-width: ${({ theme }) =>
        theme.metrics.devices.phone}) {
      ${styles}
    }
  `;
};

/**
 * Use this queries with `useMediaQuery`
 * If we need to add new queries add them here soo they can be reused
 * Always use values from theme.ts `theme.metrics.devices`, again if a new device is needed add it there
 */

export const queryPhone = toQuery({
  minWidth: theme.metrics.devices.phone,
});

export const queryMinTablet = toQuery({
  minWidth: theme.metrics.devices.tablet,
});

export const queryMaxTablet = toQuery({
  maxWidth: theme.metrics.devices.tablet,
});

export const queryMaxLaptop = toQuery({
  maxWidth: theme.metrics.devices.laptop,
});

export const queryPhoneToSmallTablet = toQuery({
  minWidth: theme.metrics.devices.phone,
  maxWidth: theme.metrics.devices.smallTablet,
});

export const queryPhoneToTablet = toQuery({
  minWidth: theme.metrics.devices.phone,
  maxWidth: theme.metrics.devices.tablet,
});

export const querySmalTabletToTablet = toQuery({
  minWidth: theme.metrics.devices.smallTablet,
  maxWidth: theme.metrics.devices.tablet,
});

export const queryTabletToDesktop = toQuery({
  minWidth: theme.metrics.devices.tablet,
  maxWidth: theme.metrics.desktop.maxWidth,
});

export const queryVerySmallDesktop = toQuery({
  minWidth: '600px',
  maxWidth: '956px',
});
