/** Pages _headers rules do not apply to Function responses. */
export function secureApiResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'geolocation=(), camera=(), microphone=()');
  headers.set('strict-transport-security', 'max-age=31536000');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
