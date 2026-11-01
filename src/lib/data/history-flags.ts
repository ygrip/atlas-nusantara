/**
 * Historical flag images for polities, taken from WorldStatesmen.org
 * (© Ben Cahoon, https://www.worldstatesmen.org/Indonesia.htm and its Traditional
 * States subpages). The atlas does NOT copy the images: each one is loaded from
 * that site with no referrer, credited in the UI, and hidden if it fails to load.
 *
 * A flag is listed only when its image file is specific to one polity. The source
 * pages reuse a few placeholder files (a generic Borneo flag, the national flag,
 * a shared Banggai image) for many states; those are deliberately not mapped.
 * Several flags are reconstructions or "possible" flags; `possible` marks them.
 */
export type FlagPage = 'main' | 'states1' | 'states2';

export interface HistoryFlag {
  file: string;
  page: FlagPage;
  possible?: boolean;
}

export const FLAG_IMAGE_BASE = 'https://www.worldstatesmen.org/';

export const FLAG_PAGE_URLS: Record<FlagPage, string> = {
  main: 'https://www.worldstatesmen.org/Indonesia.htm',
  states1: 'https://www.worldstatesmen.org/Indonesia_princely_states1.html',
  states2: 'https://www.worldstatesmen.org/Indonesia_princely_states2.html'
};

const s1 = (file: string, possible = false): HistoryFlag => ({ file, page: 'states1', possible });
const s2 = (file: string, possible = false): HistoryFlag => ({ file, page: 'states2', possible });
const main = (file: string): HistoryFlag => ({ file, page: 'main' });

export const HISTORY_FLAGS: Record<string, HistoryFlag[]> = {
  aceh: [s1('id_atj.png')],
  jambi: [s1('id-djam1.gif')],
  palembang: [s1('grn.gif')],
  siak: [s1('id-ind.gif')],
  'riau-lingga': [s1('id-ling2.gif')],
  'kesultanan-deli': [s1('id_deli.gif')],
  'kesultanan-serdang': [s1('id_negserdang.gif')],
  'kesultanan-langkat': [s1('id-langkat.gif')],
  banten: [s1('id_bant-royal.gif'), s1('id_banten.gif')],
  cirebon: [s1('id-ceribon.jpg')],
  'mataram-islam': [s1('id_mataram.gif')],
  surakarta: [s1('id-surak.gif')],
  yogyakarta: [s1('id-jog.gif')],
  mangkunegaran: [s1('id_mangku-n-state.gif')],
  pakualaman: [s1('id-pakoe.gif')],
  demak: [s1('id_demak.gif')],
  sumenep: [s1('id_sump2.gif')],
  klungkung: [s1('id-ba49.gif')],
  badung: [s1('id_bali2.gif'), s1('id_bali3.gif')],
  karangasem: [s1('id_karangasem.gif')],
  bima: [s2('id_bima.gif')],
  'sumbawa-sultanate': [s2('id_sunbawa.gif')],
  banjar: [s2('id-banj.gif')],
  bulungan: [s2('id-bulungan.gif')],
  berau: [s2('id-gunung.jpg')],
  kotawaringin: [s2('id_kutaringin-s.gif'), s2('id-kotawaringin_kalimantan.gif')],
  landak: [s2('id-landak2.gif'), s2('id-landak.gif')],
  pontianak: [s2('id_pontianak.gif')],
  tanjungpura: [s2('id_sukudana-r.gif'), s2('id-matan.gif')],
  ternate: [s2('id_tern3.gif')],
  tidore: [s2('id-tido1.gif'), s2('id-tido2.png')],
  bone: [s2('id-bone.gif')],
  'gowa-tallo': [s2('id_gowa-rstd.gif')],
  luwu: [s2('id-luwu.jpg')],
  wajo: [s2('id-wajo.jpg')],
  buton: [s2('id-butung.gif')],
  'kaimana-sran': [s2('id-kaimana.gif')],
  voc: [main('nl-voc.gif')],
  'dutch-east-indies': [main('nl.gif')],
  'japanese-occupation': [main('jp.gif')],
  'bencoolen-british': [main('gb_heic.gif')],
  'british-java': [main('gb_heic.gif')]
};

export function historyFlagsFor(polityId: string): HistoryFlag[] {
  return HISTORY_FLAGS[polityId] ?? [];
}

export function flagImageUrl(flag: HistoryFlag): string {
  return FLAG_IMAGE_BASE + flag.file;
}
