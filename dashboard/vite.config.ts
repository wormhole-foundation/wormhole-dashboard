import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/wormhole-dashboard/',
  plugins: [
    react(),
    viteTsconfigPaths(),
    svgr({
      include: '**/*.svg?react',
    }),
  ],
  // https://vitejs.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies
  optimizeDeps: {
    include: ['@wormhole-foundation/wormhole-monitor-common'],
  },
  build: {
    commonjsOptions: {
      include: [/common/, /node_modules/],
    },
  },
  server: {
    proxy: {
      '/wormchain': {
        target: 'https://gateway.mainnet.xlabs.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wormchain/, ''),
      },
      '/wormchain-testnet': {
        target: 'https://gateway.testnet.xlabs.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wormchain-testnet/, ''),
      },
    },
  },
});
