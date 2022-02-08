import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), legacy()],
  build: {
    sourcemap: process.env.VITE_ENV === 'development',
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
