import { createGlobalStyle } from 'styled-components';
import { theme } from 'styles/theme';
import megant from 'assets/fonts/Megant/Megant.ttf';
import caviarDreams from 'assets/fonts/CaviarDreams/CaviarDreams.ttf';
import caviarDreamsBold from 'assets/fonts/CaviarDreams/CaviarDreams_Bold.ttf';
import caviarDreamsBoldItalic from 'assets/fonts/CaviarDreams/CaviarDreams_BoldItalic.ttf';
import caviarDreamsItalic from 'assets/fonts/CaviarDreams/CaviarDreams_Italic.ttf';
import { tabletAndAbove } from './breakpoints';

export const ROOT_FONT_SIZE = 16;

export const GlobalStyle = createGlobalStyle`

  // Fonts
  @font-face {
    font-family: "Megant";
    src: url(${megant});
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url(${caviarDreams});
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url(${caviarDreamsBold});
    font-style: normal;
    font-weight: 700;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url(${caviarDreamsBoldItalic});
    font-style: italic;
    font-weight: 700;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url(${caviarDreamsItalic});
    font-style: italic;
    font-weight: 400;
    font-display: swap;
  }

  *,
  *:before,
  *:after {
    box-sizing: border-box;
    //padding: 0;
    //margin: 0;
  }

  html,
  body {
    font-family: Caviar Dreams, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
    font-size: ${ROOT_FONT_SIZE}px;
    background-color: ${theme.palette.dark};
    color: ${theme.palette.light};
    overflow-x: hidden;
    margin: 0px;
    min-height: 100vh;
    min-width: 320px;
    ${tabletAndAbove(`
      min-width: 100vw;
    `)}
  }

  h1,
  h2,
  h3,
  h4,
  h5 {
    ${theme.typography.fonts.fontHeading}
    color: ${theme.palette.brand}
  }

  h1 {
    font-size: 3rem /* 48/16 */;
    line-height: 5.5625rem /* 89/16 */;
    margin-bottom: 1em;
  }

  h2 {
    font-size: 2.25rem /* 36/16 */;
    line-height: 4.1875rem /* 67/16 */;
  }

  h3 {
    margin-top: 1em;
    font-size: 1.75rem /* 28/16 */;
    line-height: 1.4;
  }

  h4 {
    font-size: 1.5rem /* 24/16 */;
    line-height: 2.75rem /* 44/16 */;
  }

  h5 {
    font-size: 1.25rem  /* 20/16 */;
    line-height: 1.5rem  /* 24/16 */;
  }

  p {
    font-size: 1.125rem /* 18/16 */;
    line-height: 1.25rem /* 20/16 */;
  }

  a {
    color: ${theme.palette.brand};
    text-decoration: none;
    font-weight: bold;
  }

  small {
    font-size: 0.875rem  /* 14/16 */;
    font-weight: bold;
  }

  button {
    ${theme.typography.fonts.fontBody}
  }

  section {
    padding-top: 64px;
    padding-bottom: 64px;
  }

  // helpers
  .margin {
    &-remove {
      margin: 0;
    }

    &-remove--bottom {
      margin-bottom: 0;
    }
    &-remove--top {
      margin-top: 0;
    }
    &-remove--left {
      margin-left: 0;
    }
    &-remove--right {
      margin-right: 0;
    }
  }

  .color {
    &-brand {
      color: ${theme.palette.brand};
    }

    &-brandLight {
      color: ${theme.palette.brandLight};
    }

    &-brandDark {
      color: ${theme.palette.brandDark};
    }

    &-brandDarker {
      color: ${theme.palette.brandDarker};
    }

    &-dark {
      color: ${theme.palette.dark};
    }

    &-light {
      color: ${theme.palette.light};
    }
  }

  .align-text {
    &-center {
      text-align: center;
    }
  }

  .flex {
    display: flex;
    &-v-center {
      align-items: center;
    }
  }

  // Scrollbars
  /* width */
  ::-webkit-scrollbar {
    width: 0.375rem  /* 6/16 */;
  }

  /* Track */
  ::-webkit-scrollbar-track {
    width: 1px;
    box-shadow: inset 0 0 0.3125rem  /* 5/16 */ ${theme.palette.light50};
    border-radius: 0.3125rem  /* 5/16 */;
  }

  /* Handle */
  ::-webkit-scrollbar-thumb {
    background-color: ${theme.palette.brand};
    box-shadow: 0 0 0.25rem  /* 4/16 */ ${theme.palette.brandDark};
    border-radius: 0.1875rem  /* 3/16 */;
  }

  /* Handle on hover */
  ::-webkit-scrollbar-thumb:hover {
    background-color: ${theme.palette.brandDark};
  }

  // Tippy arrow global style
  .tippy-svg-arrow {
    fill: ${theme.palette.brand};
  }
`;
