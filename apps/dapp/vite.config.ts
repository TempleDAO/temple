import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { dependencies } from './package.json';

const VENDOR_CHUNKS = new Set([
  'react',
  'react-router-dom',
  'react-dom',
  'styled-components',
  'polished',
]);

const VISUALIZATION_CHUNKS = new Set([
  'd3-shape',
  'react-vis',
]);

const renderChunks = (deps: Record<string, string>) => {
  const chunks: Record<string, string[]> = {};
  Object.keys(deps).forEach((dep) => {
    if (
      VENDOR_CHUNKS.has(dep) ||
      VISUALIZATION_CHUNKS.has(dep)
    ) {
      return;
    }
    chunks[dep] = [dep];
  });
  return chunks;
};

const plugins = [
  react(),
  legacy(),
];

if (process.env.BUILD_STATS) {
  plugins.push(visualizer());
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins,
  build: {
    sourcemap: process.env.VITE_ENV === 'development',
    rollupOptions: {
      // external: Array.from(EXTERNAL_DEPS),
      output: {
        manualChunks: {
          vendor: Array.from(VENDOR_CHUNKS),
          visualizations: Array.from(VISUALIZATION_CHUNKS),
          ...renderChunks(dependencies),
        },
      },
    },
  },
  define: {
    // WalletLink requires process to be a global.
    'process.env': {}
  },
  resolve: {
    alias: {
      process: 'process',
      util: 'util',
      components: path.resolve(__dirname, 'src/components'),
      providers: path.resolve(__dirname, 'src/providers'),
      assets: path.resolve(__dirname, 'src/assets'),
      styles: path.resolve(__dirname, 'src/styles'),
      utils: path.resolve(__dirname, 'src/utils'),
      hooks: path.resolve(__dirname, 'src/hooks'),
      services: path.resolve(__dirname, 'src/services'),
      hoc: path.resolve(__dirname, 'src/hoc'),
      enums: path.resolve(__dirname, 'src/enums'),
      constants: path.resolve(__dirname, 'src/constants'),
      data: path.resolve(__dirname, 'src/data'),
      types: path.resolve(__dirname, 'src/types'),
    },
  },
  envPrefix: 'VITE',
});
