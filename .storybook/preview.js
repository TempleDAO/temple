import { ThemeProvider } from 'styled-components';
import { addDecorator } from '@storybook/react';
import { withThemes } from '@react-theming/storybook-addon';

import { theme } from '../styles/theme';
import { GlobalStyle } from '../styles/GlobalStyle';
import './storybook.css'


export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
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
  }
}

// pass ThemeProvider and array of your themes to decorator
addDecorator(withThemes(ThemeProvider, [theme]));
// Adding global Styles to storybook
addDecorator(s => <><GlobalStyle/>{s()}</>);
