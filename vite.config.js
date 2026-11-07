import { defineConfig } from 'vite';

// base './' lets the built site run from any folder or static host.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
