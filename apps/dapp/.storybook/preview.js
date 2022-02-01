import { ThemeProvider } from 'styled-components';
import { addDecorator } from '@storybook/react';
import { withThemesProvider } from 'storybook-addon-styled-component-theme';

import { theme } from 'styles/theme';
import { GlobalStyle } from 'styles/GlobalStyle';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  backgrounds: {
    disable: true,
    grid: {
      cellSize: 16,
      opacity: 0.5,
      cellAmount: 5,
    },
  },
};

// Adding global Styles to storybook
addDecorator((Story) => (
  <>
    <GlobalStyle />
    {<Story />}
  </>
));
// pass ThemeProvider and array of your themes to decorator
addDecorator(withThemesProvider([theme]), ThemeProvider);
