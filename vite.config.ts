import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  base: mode === 'production' ? '/nano-battleship/' : '/',
}));
