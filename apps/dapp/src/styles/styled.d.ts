// import original module declarations
import 'styled-components';
import { FlattenSimpleInterpolation, Keyframes } from 'styled-components';

// and extend them!
declare module 'styled-components' {
  export interface DefaultTheme {
    palette: {
      brand: string;
      brand25: string;
      brand50: string;
      brand75: string;
      dark: string;
      dark75: string;
      grayOpaque: string;
      light: string;
      light75: string;
      light50: string;
      enclave: {
        structure: string;
        order: string;
        chaos: string;
        mystery: string;
        logic: string;
      };
    };
    metrics: {
      headerHeight: string;
      desktop: {
        maxWidth: string;
      };
      devices: {
        tablet: string;
        laptop: string;
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
