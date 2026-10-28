import { assetUrl } from '$lib/pwa/assets';
import { isLanguageData, type LanguageData } from './languages-contract';
export { isLanguageData, languageClassIndex, rankProvinces, LANGUAGE_CLASS_MAXIMUMS } from './languages-contract';
export type { LanguageData, ProvinceLanguages } from './languages-contract';

let pending: Promise<LanguageData> | undefined;

async function fetchLanguages(): Promise<LanguageData> {
  const response = await fetch(assetUrl('/data/observations/languages.json'));
  if (!response.ok) throw new Error('Language data unavailable');
  const value: unknown = await response.json();
  if (!isLanguageData(value)) throw new Error('Language data failed validation');
  return value;
}

/** Read once per page; the map colours and the panel share the result. A failed read is retried on the next call. */
export function loadLanguages(): Promise<LanguageData> {
  if (!pending) {
    pending = fetchLanguages();
    pending.catch(() => { pending = undefined; });
  }
  return pending;
}
