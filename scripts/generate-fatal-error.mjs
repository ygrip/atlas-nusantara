import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// A fatal SvelteKit response must work without the app bundle or a network request.
// Only the existing Inlang error messages are embedded, not the full catalogs.
export const FATAL_KEYS = [
  'error_label', 'error_title', 'error_try', 'error_back', 'error_500_alt',
  'error_500_title', 'error_500_desc', 'error_503_title', 'error_503_desc'
];

const json = async (url) => JSON.parse(await readFile(url, 'utf8'));
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export async function buildFatalErrorFallback() {
  const root = new URL('../', import.meta.url);
  const project = await json(new URL('project.inlang/settings.json', root));
  const template = await readFile(new URL('src/error.template.html', root), 'utf8');
  const translations = {};

  for (const locale of project.locales) {
    const catalog = await json(new URL('messages/' + locale + '.json', root));
    const copy = {};
    for (const key of FATAL_KEYS) {
      const value = catalog[key];
      if (typeof value !== 'string' || !value.trim() || /\{[^}]*\}/.test(value)) {
        throw new Error('Invalid fatal fallback message: ' + locale + '/' + key);
      }
      copy[key] = value;
    }
    translations[locale] = copy;
  }
  const en = translations[project.baseLocale];
  if (!en) throw new Error('Fatal fallback is missing its base locale');

  // Escape script-breaking markup before embedding translated text as JSON.
  const data = JSON.stringify(translations).replaceAll('<', '\\u003c');
  const script = [
    '(() => {',
    '  const translations = ' + data + ';',
    '  const wanted = location.pathname.split("/")[1];',
    '  const locale = Object.prototype.hasOwnProperty.call(translations, wanted) ? wanted : ' + JSON.stringify(project.baseLocale) + ';',
    '  const copy = translations[locale];',
    '  const code = document.getElementById("fatal-status");',
    '  const status = code.dataset.status;',
    '  const group = status === "503" ? "503" : "500";',
    '  document.documentElement.lang = locale;',
    '  document.title = status + " · " + copy.error_title + " · Atlas Nusantara";',
    '  code.textContent = copy.error_label + " " + status;',
    '  document.getElementById("fatal-heading").textContent = copy["error_" + group + "_title"];',
    '  document.getElementById("fatal-description").textContent = copy["error_" + group + "_desc"];',
    '  document.getElementById("fatal-navigation").setAttribute("aria-label", copy.error_title);',
    '  document.getElementById("fatal-retry").textContent = copy.error_try;',
    '  document.getElementById("fatal-home").textContent = copy.error_back;',
    '  document.getElementById("fatal-home").href = locale === ' + JSON.stringify(project.baseLocale) + ' ? "/" : "/" + locale + "/";',
    '  document.getElementById("art-title").textContent = copy.error_500_alt;',
    '})();'
  ].join('\n');

  const hash = createHash('sha256').update(script, 'utf8').digest('base64');
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-' + hash + '\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">';
  const replace = {
    '%%FATAL_CSP%%': csp,
    '%%FATAL_PAGE_TITLE%%': escapeHtml(en.error_title),
    '%%FATAL_STATUS_LABEL%%': escapeHtml(en.error_label),
    '%%FATAL_HEADING%%': escapeHtml(en.error_500_title),
    '%%FATAL_DESCRIPTION%%': escapeHtml(en.error_500_desc),
    '%%FATAL_RETRY%%': escapeHtml(en.error_try),
    '%%FATAL_HOME%%': escapeHtml(en.error_back),
    '%%FATAL_ALT%%': escapeHtml(en.error_500_alt),
    '%%FATAL_SCRIPT%%': '<script>' + script + '</script>'
  };
  let html = template;
  for (const [token, value] of Object.entries(replace)) {
    if (!html.includes(token)) throw new Error('Missing fatal template token: ' + token);
    html = html.replaceAll(token, value);
  }
  if (html.includes('%%FATAL_')) throw new Error('Unresolved fatal template token');
  return { html, script, translations, hash };
}

export async function generateFatalErrorFallback() {
  const { html } = await buildFatalErrorFallback();
  await writeFile(new URL('../src/error.html', import.meta.url), html);
  console.log('Generated standalone 13-locale fatal error fallback');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateFatalErrorFallback();
}
