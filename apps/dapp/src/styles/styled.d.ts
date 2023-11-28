// import original module declarations
import 'styled-components';
import { FlattenSimpleInterpolation, Keyframes } from 'styled-components';

// and extend them!
declare module 'styled-components' {
  export interface DefaultTheme {
    palette: {
      black: string;
      brand: string;
      brandLight: string;
      brandDark: string;
      brandDarker: string;
      brand25: string;
      brand50: string;
      brand75: string;
      dark: string;
      dark75: string;
      grayOpaque: string;
      light: string;
      light75: string;
      light50: string;
      charts: string[];
      enclave: {
        structure: string;
        order: string;
        chaos: string;
        mystery: string;
        logic: string;
      };
      gradients: {
        dark: string;
        grey: string;
        greyVertical: string;
      };
    };
    metrics: {
      headerHeight: string;
      desktop: {
        minWidth: string;
        maxWidth: string;
      };
      devices: {
        smallTablet: string;
        tablet: string;
        laptop: string;
        phone: string;
      };
    };
    typography: {
      fonts: {
        fontHeading: string;
        fontBody: string;
      };
      h1: FlattenSimpleInterpolation;
      h2: FlattenSimpleInterpolation;
      h3: FlattenSimpleInterpolation;
      h4: FlattenSimpleInterpolation;
      body: FlattenSimpleInterpolation;
      meta: FlattenSimpleInterpolation;
    };
    transitions: {
      color: string;
      backgroundColor: string;
    };
    animations: {
      spin: FlattenSimpleInterpolation;
      loading: FlattenSimpleInterpolation;
    };
    shadows: {
      base: string;
    };
    zIndexes: {
      below: number;
      base: number;
      up: number;
      top: number;
      max: number;
    };
  }
}
