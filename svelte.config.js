import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { PREFIXED_LOCALES } from './src/lib/i18n/paths.js';

const routes = ['', '/terms', '/privacy', '/about', '/guides', '/guides/regions', '/guides/conditions', '/guides/nature'];
const entries = routes.map(route => route || '/');
for (const locale of PREFIXED_LOCALES) {
  for (const route of routes) entries.push('/' + locale + route);
}

export default {
  preprocess: vitePreprocess(),
  kit: {
    paths: { relative: false },
    prerender: { entries },
    serviceWorker: { register: true, options: { updateViaCache: 'none' } },
    adapter: adapter({ pages: 'build', assets: 'build', fallback: '200.html' })
  }
};
