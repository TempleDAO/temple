import { toQuery } from 'react-responsive';
import { css, FlattenInterpolation, ThemeProps, DefaultTheme } from 'styled-components';
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
