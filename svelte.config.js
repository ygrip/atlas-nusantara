import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess(), kit: { serviceWorker: { register: true, options: { updateViaCache: 'none' } }, adapter: adapter({ pages: 'build', assets: 'build', fallback: '200.html' }) } };
