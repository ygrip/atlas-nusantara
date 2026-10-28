import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server.js';

// Request-scoped locale state keeps simultaneous prerenders in their own language.
export const handle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ locale }) => resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', '<html lang="' + locale + '">')
  }));
