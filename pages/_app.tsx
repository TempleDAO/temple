import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from 'styled-components';
import BaseLayout from '../components/Layouts/Base';
import NotificationManager from '../components/Notification/NotificationManager';
import { NotificationProvider } from '../providers/NotificationProvider';
import { WalletProvider } from '../providers/WalletProvider';
import { GlobalStyle } from '../styles/GlobalStyle';
import { theme } from '../styles/theme';

function MyApp({ Component, pageProps }: AppProps) {
  return (
      <>
        <html lang={'en-US'}/>
        <Head>
          <title>Temple DAO</title>
          <meta charSet="utf-8"/>
          <meta httpEquiv="X-UA-Compatible" content="IE=edge"/>
          <meta
              name="viewport"
              content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5"
          />
          <meta name="description"
                content="In a world of volatility and stress, the Temple of long term wealth creation is where disciples come to stake, sleep easy, and chill."/>
          <meta name="keywords" content="Keywords"/>
          <link rel="manifest" href="/manifest.json"/>
          <link
              href="/icons/favicon-16x16.png"
              rel="icon"
              type="image/png"
              sizes="16x16"
          />
          <link
              href="/icons/favicon-32x32.png"
              rel="icon"
              type="image/png"
              sizes="32x32"
          />
          <link rel="apple-touch-icon" href="/apple-icon.png"/>
          <meta name="theme-color" content="#BD7B4F"/>
          <link
              rel="preload"
              href="/fonts/Megant/Megant.ttf"
              as="font"
              crossOrigin=""
          />
          <link
              rel="preload"
              href="/fonts/CaviarDreams/CaviarDreams.ttf"
              as="font"
              crossOrigin=""
          />
          <link
              rel="preload"
              href="/fonts/CaviarDreams/CaviarDreams_Bold.ttf"
              as="font"
              crossOrigin=""
          />
          <link
              rel="preload"
              href="/fonts/CaviarDreams/CaviarDreams_BoldItalic.ttf"
              as="font"
              crossOrigin=""
          />
          <link
              rel="preload"
              href="/fonts/CaviarDreams/CaviarDreams_Italic.ttf"
              as="font"
              crossOrigin=""
          />
        </Head>
        <GlobalStyle/>
        <NotificationProvider>
          <WalletProvider>
            <ThemeProvider theme={theme}>
              <BaseLayout>
                <Component {...pageProps} />
              </BaseLayout>
              <NotificationManager />
            </ThemeProvider>
          </WalletProvider>
        </NotificationProvider>
      </>
  );
}

export default MyApp;
