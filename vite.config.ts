import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solid(), { name: 'solid2-primitives-compat', enforce: 'pre', transform(code, id) { if (id.includes('@solid-primitives/utils/dist/index.js')) return code.replace(', equalFn,', ',').replace('export const defaultEquals = equalFn;', 'export const defaultEquals = (a, b) => a === b;'); } }],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
