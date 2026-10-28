import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
export default defineConfig({
 build: {
  // three.js (~830 kB minified) is lazy-loaded by ClayMap via dynamic import and cannot be split further.
  chunkSizeWarningLimit: 900
 },
 plugins: [
  sveltekit(),
  paraglideVitePlugin({
   project: './project.inlang',
   outdir: './src/lib/paraglide',
   strategy: ['url', 'baseLocale']
  })
 ]
});
