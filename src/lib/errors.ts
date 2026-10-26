export type ErrorGroup = '404' | '403' | '429' | '503' | '500' | 'other';

export interface ErrorPresentation {
  /** Selects the localized copy in +error.svelte; this module stays free of UI imports so it is unit-testable. */
  group: ErrorGroup;
  illustration: '404' | '500';
  retry: boolean;
  /** English fallback used only for App.Error.message, never shown instead of localized copy. */
  fallbackTitle: string;
}

const missing: ErrorPresentation = {
  group: '404', illustration: '404', retry: false, fallbackTitle: 'This place is not on the map.'
};
const paused: ErrorPresentation = {
  group: '500', illustration: '500', retry: true, fallbackTitle: 'The atlas needs a short pause.'
};

export function errorPresentation(status: number): ErrorPresentation {
  if (status === 404) return missing;
  if (status === 401 || status === 403) {
    return { ...missing, group: '403', fallbackTitle: 'This page is not open to you.' };
  }
  if (status === 429) {
    return { ...paused, group: '429', fallbackTitle: 'Too many requests at once.' };
  }
  if (status === 503) {
    return { ...paused, group: '503', fallbackTitle: 'The atlas is resting for a moment.' };
  }
  if (status >= 500) return paused;
  return { ...missing, group: 'other', fallbackTitle: 'We could not open that page.' };
}

const knownErrorNames = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError']);

function safeErrorKind(error: unknown): string {
  try {
    // Read once: arbitrary Error subclasses may have stateful or throwing getters.
    if (!(error instanceof Error)) return 'UnknownError';
    const name = error.name;
    if (typeof name === 'string' && knownErrorNames.has(name)) return name;
  } catch {
    return 'UnknownError';
  }
  return 'UnknownError';
}

export interface PublicError {
  message: string;
  incidentId?: string;
}

/** Public errors carry a reference, never a raw exception message or credential-bearing text. */
export function reportUnexpectedError(error: unknown, status: number, source: 'client' | 'server'): PublicError {
  // Missing routes and other expected request errors are not incidents.
  if (status >= 400 && status < 500) {
    return { message: errorPresentation(status).fallbackTitle };
  }
  const incidentId = crypto.randomUUID();
  // Exception messages and objects can contain user data or secrets, so only a narrow set of fields is logged.
  console.error('[nusantara] unexpected error', { incidentId, status, source, kind: safeErrorKind(error) });
  return { message: 'Something went wrong on our side. Please try again.', incidentId };
}
