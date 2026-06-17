import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 3000, open: true },
  preview: { port: 4000 },
});