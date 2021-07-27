import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';

export const GlobalStyle = createGlobalStyle`

  // Fonts
  @font-face {
    font-family: "Megant";
    src: url("/fonts/Megant/Megant.ttf");
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url("/fonts/CaviarDreams/CaviarDreams.ttf");
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url("/fonts/CaviarDreams/CaviarDreams_Bold.ttf");
    font-style: normal;
    font-weight: 700;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url("/fonts/CaviarDreams/CaviarDreams_BoldItalic.ttf");
    font-style: italic;
    font-weight: 700;
    font-display: swap;
  }

  @font-face {
    font-family: "Caviar Dreams";
    src: url("/fonts/CaviarDreams/CaviarDreams_Italic.ttf");
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
    font-size: 16px;
    background-color: ${theme.palette.dark};
    color: ${theme.palette.light};
    overflow-x: hidden;
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
    margin-bottom: 3rem  /* 48/16 */
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
  }

  .color {
    &-brand {
      color: ${theme.palette.brand};
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

`;
