import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';
import analyze from 'rollup-plugin-analyzer';
import { dependencies } from './package.json';

const VENDOR_CHUNKS = new Set([
  'react',
  'react-router-dom',
  'react-dom',
  'howler',
  'ethers',
]);

const renderChunks = (deps: Record<string, string>) => {
  const chunks: Record<string, string[]> = {};
  Object.keys(deps).forEach((key) => {
    if (VENDOR_CHUNKS.has(key)) {
      return;
    }
    chunks[key] = [key];
  });
  return chunks;
};

const IS_DEV = process.env.VITE_ENV === 'development';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), legacy()],
  build: {
    sourcemap: IS_DEV,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: Array.from(VENDOR_CHUNKS),
          ...renderChunks(dependencies),
        },
      },
      plugins: [analyze()],
    },
  },
  resolve: {
    alias: {
      components: path.resolve(__dirname, 'src/components'),
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
    },
  },
  envPrefix: 'VITE',
});
