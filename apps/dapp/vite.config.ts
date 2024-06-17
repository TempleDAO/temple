import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { dependencies } from './package.json';

const VENDOR_CHUNKS = new Set([
  'react',
  'react-router-dom',
  'react-dom',
  'styled-components',
  'polished',
]);

const VISUALIZATION_CHUNKS = new Set(['d3-shape', 'react-vis']);

const renderChunks = (deps: Record<string, string>) => {
  const chunks: Record<string, string[]> = {};
  Object.keys(deps).forEach((dep) => {
    if (VENDOR_CHUNKS.has(dep) || VISUALIZATION_CHUNKS.has(dep)) {
      return;
    }
    chunks[dep] = [dep];
  });
  return chunks;
};

const plugins = [
  react({
    babel: {
      plugins: ['babel-plugin-styled-components'],
    },
  }),
  svgr(),
  legacy(),
];

const VITE_ENV = process.env.VITE_ENV;
const shouldBuildSourceMap = VITE_ENV === 'local';

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  plugins,
  build: {
    target: 'es2020',
    sourcemap: shouldBuildSourceMap,
    rollupOptions: {
      // fixes flaky vercel build
      external: ['/.*walletconnect.*/'],
      // https://github.com/TanStack/query/issues/5175
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          vendor: Array.from(VENDOR_CHUNKS),
          visualizations: Array.from(VISUALIZATION_CHUNKS),
          ...renderChunks(dependencies),
        },
      },
    },
    // https://github.com/vitejs/vite/issues/15378
    assetsInlineLimit: (file) => {
      return !file.endsWith('.svg');
    },
  },
  define: {
    // WalletLink requires process to be a global.
    'process.env': {},
  },
  resolve: {
    alias: {
      process: 'process',
      util: 'util',
      components: path.resolve(__dirname, 'src/components'),
      pages: path.resolve(__dirname, 'src/pages'),
      providers: path.resolve(__dirname, 'src/providers'),
      assets: path.resolve(__dirname, 'src/assets'),
      styles: path.resolve(__dirname, 'src/styles'),
      utils: path.resolve(__dirname, 'src/utils'),
      hooks: path.resolve(__dirname, 'src/hooks'),
      services: path.resolve(__dirname, 'src/services'),
      hoc: path.resolve(__dirname, 'src/hoc'),
      enums: path.resolve(__dirname, 'src/enums'),
      data: path.resolve(__dirname, 'src/data'),
      types: path.resolve(__dirname, 'src/types'),
      constants: path.resolve(__dirname, 'src/constants'),
      safe: path.resolve(__dirname, 'src/safe'),
    },
  },
  envPrefix: 'VITE',
  server: {
    port: 3000,
  },
});
