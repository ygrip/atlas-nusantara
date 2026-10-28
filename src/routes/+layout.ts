export const ssr = true;
export const prerender = true;
// /id and /id/ are the same page, so never rewrite the URL to add or drop a slash.
export const trailingSlash = 'ignore';
