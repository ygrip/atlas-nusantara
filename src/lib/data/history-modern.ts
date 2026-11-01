/**
 * Dated modern status register for contested regional transitions, 1945–present.
 *
 * Annual views use the status in effect after that calendar year's major recorded
 * transition. Established exact dates remain attached; year-only phase starts
 * carry explicit precision, and a year label is not a claim that status applied
 * from January 1. Administrative status,
 * effective control, occupation, and legal sovereignty are distinct; this
 * source-limited register does not determine sovereignty or claim comprehensive
 * military control.
 */
export const HISTORY_PRESENT_YEAR = new Date().getUTCFullYear();

export type ModernRegionId = 'western-new-guinea' | 'timor-leste';
export type ModernActorId = 'netherlands' | 'portugal' | 'un' | 'indonesia' | 'timor-leste';
export type ModernStatus =
  | 'colonial-administration'
  | 'un-administration'
  | 'indonesian-administration'
  | 'indonesian-occupation'
  | 'independent-state';

export interface ModernStatusPhase {
  id: string;
  region: ModernRegionId;
  status: ModernStatus;
  actor: ModernActorId;
  from: string | null;
  fromPrecision: 'day' | 'year';
  to: string | null;
  annualFrom: number;
  annualTo: number;
  certainty: 'documented-administration' | 'occupied-disputed-annexation' | 'recognized-independence';
  translationKey: string;
  note: { en: string; id: string };
  sources: readonly string[];
}

export type ModernMilestoneKind =
  | 'independence-declaration'
  | 'sovereignty-transfer'
  | 'un-administration-start'
  | 'administration-transfer'
  | 'contested-political-process'
  | 'invasion'
  | 'unrecognized-annexation'
  | 'referendum'
  | 'un-transition-administration'
  | 'withdrawal-complete'
  | 'independence';

export interface ModernMilestone {
  id: string;
  date: string;
  region: ModernRegionId | 'indonesia';
  kind: ModernMilestoneKind;
  translationKey: string;
  note: { en: string; id: string };
  sources: readonly string[];
}

export const MODERN_STATUS_SOURCES = {
  indonesianDeclaration: 'https://setneg.go.id/baca/index/membuka_catatan_sejarah_detik_detik_proklamasi_17_agustus_1945',
  sovereigntyTransfer: 'https://digitallibrary.un.org/record/704529/files/A_1361-EN.pdf',
  newYorkAgreement: 'https://treaties.un.org/doc/publication/unts/volume%20437/volume-437-i-6311-english.pdf',
  westNewGuineaChronology: 'https://peacekeeping.un.org/sites/default/files/past/unsfbackgr.html',
  actOfFreeChoiceResolution: 'https://digitallibrary.un.org/record/657429',
  eastTimorChronology: 'https://peacekeeping.un.org/sites/default/files/past/etimor/Untaetchrono.html',
  untaetResolution: 'https://digitallibrary.un.org/record/291410/?ln=en',
  unmissetBackground: 'https://peacekeeping.un.org/sites/default/files/past/unmiset/background.html'
} as const;

const NEW_GUINEA_TRANSFER_SOURCES = [
  MODERN_STATUS_SOURCES.sovereigntyTransfer,
  MODERN_STATUS_SOURCES.newYorkAgreement,
  MODERN_STATUS_SOURCES.westNewGuineaChronology
] as const;

const TIMOR_TRANSITION_SOURCES = [
  MODERN_STATUS_SOURCES.eastTimorChronology,
  MODERN_STATUS_SOURCES.untaetResolution,
  MODERN_STATUS_SOURCES.unmissetBackground
] as const;

/** Null phase dates are unverified; fromPrecision records year-only annual starts explicitly. */
export const MODERN_STATUS_PHASES: readonly ModernStatusPhase[] = [
  {
    id: 'western-new-guinea-dutch-administration', region: 'western-new-guinea',
    status: 'colonial-administration', actor: 'netherlands',
    from: null, fromPrecision: 'year', to: '1962-09-30', annualFrom: 1945, annualTo: 1961,
    certainty: 'documented-administration', translationKey: 'history_modern_wng_dutch',
    note: {
      en: 'This register starts with the 1945 post-transition annual view; that does not document a handover on 1 January. Dutch administration continued after the 1949 transfer of sovereignty, which explicitly excluded Dutch New Guinea.',
      id: 'Register ini dimulai dengan tampilan tahunan pascaperalihan 1945; hal itu bukan dokumentasi serah terima pada 1 Januari. Pemerintahan Belanda berlanjut setelah penyerahan kedaulatan 1949, yang secara tegas mengecualikan Nugini Belanda.'
    }, sources: [MODERN_STATUS_SOURCES.sovereigntyTransfer, MODERN_STATUS_SOURCES.newYorkAgreement]
  },
  {
    id: 'western-new-guinea-untea-administration', region: 'western-new-guinea',
    status: 'un-administration', actor: 'un',
    from: '1962-10-01', fromPrecision: 'day', to: '1963-04-30', annualFrom: 1962, annualTo: 1962,
    certainty: 'documented-administration', translationKey: 'history_modern_wng_un',
    note: {
      en: 'UNTEA administered the territory under the New York Agreement; this was a temporary UN administration.',
      id: 'UNTEA memerintah wilayah ini berdasarkan Persetujuan New York; pemerintahan PBB ini bersifat sementara.'
    }, sources: [MODERN_STATUS_SOURCES.newYorkAgreement, MODERN_STATUS_SOURCES.westNewGuineaChronology]
  },
  {
    id: 'western-new-guinea-indonesian-administration', region: 'western-new-guinea',
    status: 'indonesian-administration', actor: 'indonesia',
    from: '1963-05-01', fromPrecision: 'day', to: null, annualFrom: 1963, annualTo: HISTORY_PRESENT_YEAR,
    certainty: 'documented-administration', translationKey: 'history_modern_wng_indonesia',
    note: {
      en: 'Administration transferred from UNTEA to Indonesia on 1 May 1963. The 1969 representative-council process remains disputed; UNGA Resolution 2504 records completion of the UN role, not a finding that the process was fair.',
      id: 'Pemerintahan beralih dari UNTEA kepada Indonesia pada 1 Mei 1963. Proses Dewan Musyawarah 1969 tetap diperdebatkan; Resolusi MU PBB 2504 mencatat selesainya peran PBB, bukan putusan bahwa prosesnya adil.'
    }, sources: [...NEW_GUINEA_TRANSFER_SOURCES, MODERN_STATUS_SOURCES.actOfFreeChoiceResolution]
  },
  {
    id: 'timor-leste-portuguese-administration', region: 'timor-leste',
    status: 'colonial-administration', actor: 'portugal',
    from: null, fromPrecision: 'year', to: '1975-12-06', annualFrom: 1945, annualTo: 1974,
    certainty: 'documented-administration', translationKey: 'history_modern_timor_portuguese',
    note: {
      en: 'The 1945 annual view shows Portuguese administration after the wartime transition; its precise restoration date is not asserted here. Portuguese administration preceded Indonesia’s invasion.',
      id: 'Tampilan tahunan 1945 menunjukkan pemerintahan Portugis setelah peralihan masa perang; tanggal pemulihan pemerintahan yang tepat tidak dinyatakan. Pemerintahan Portugis mendahului invasi Indonesia.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'timor-leste-indonesian-occupation', region: 'timor-leste',
    status: 'indonesian-occupation', actor: 'indonesia',
    from: '1975-12-07', fromPrecision: 'day', to: '1999-10-24', annualFrom: 1975, annualTo: 1998,
    certainty: 'occupied-disputed-annexation', translationKey: 'history_modern_timor_occupation',
    note: {
      en: 'Indonesia invaded on 7 December 1975. Its 1976 annexation was not recognized by the United Nations; occupation is not presented as settled sovereignty.',
      id: 'Indonesia menginvasi pada 7 Desember 1975. Aneksasi 1976 tidak diakui Perserikatan Bangsa-Bangsa; pendudukan ini tidak disajikan sebagai kedaulatan yang telah disepakati.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'timor-leste-un-transition-administration', region: 'timor-leste',
    status: 'un-administration', actor: 'un',
    from: '1999-10-25', fromPrecision: 'day', to: '2002-05-19', annualFrom: 1999, annualTo: 2001,
    certainty: 'documented-administration', translationKey: 'history_modern_timor_un',
    note: {
      en: 'UNTAET administered the transition from 25 October 1999. Indonesian withdrawal was completed on 31 October 1999; independence followed on 20 May 2002.',
      id: 'UNTAET memerintah masa transisi sejak 25 Oktober 1999. Penarikan Indonesia selesai pada 31 Oktober 1999; kemerdekaan menyusul pada 20 Mei 2002.'
    }, sources: [...TIMOR_TRANSITION_SOURCES]
  },
  {
    id: 'timor-leste-independent-state', region: 'timor-leste',
    status: 'independent-state', actor: 'timor-leste',
    from: '2002-05-20', fromPrecision: 'day', to: null, annualFrom: 2002, annualTo: HISTORY_PRESENT_YEAR,
    certainty: 'recognized-independence', translationKey: 'history_modern_timor_independent',
    note: {
      en: 'Timor-Leste became independent on 20 May 2002, after UN transitional administration. This was not an ordinary Indonesian provincial secession in 1999.',
      id: 'Timor-Leste merdeka pada 20 Mei 2002 setelah pemerintahan transisi PBB. Peristiwa ini bukan pemisahan provinsi Indonesia biasa pada 1999.'
    }, sources: [...TIMOR_TRANSITION_SOURCES]
  }
];

export const MODERN_MILESTONES: readonly ModernMilestone[] = [
  {
    id: 'indonesia-proclaimed-independence', date: '1945-08-17', region: 'indonesia',
    kind: 'independence-declaration', translationKey: 'history_event_modern_indonesia_declaration',
    note: {
      en: 'Indonesia proclaimed independence. The proclamation date is distinct from the 1949 transfer of sovereignty.',
      id: 'Indonesia memproklamasikan kemerdekaan. Tanggal proklamasi berbeda dari penyerahan kedaulatan pada 1949.'
    }, sources: [MODERN_STATUS_SOURCES.indonesianDeclaration]
  },
  {
    id: 'dutch-transfer-federal-indonesia', date: '1949-12-27', region: 'indonesia',
    kind: 'sovereignty-transfer', translationKey: 'history_event_modern_sovereignty_transfer',
    note: {
      en: 'The Netherlands transferred sovereignty to the federal United States of Indonesia; Dutch New Guinea was excluded.',
      id: 'Belanda menyerahkan kedaulatan kepada Republik Indonesia Serikat; Nugini Belanda dikecualikan.'
    }, sources: [MODERN_STATUS_SOURCES.sovereigntyTransfer]
  },
  {
    id: 'untea-begins-west-new-guinea-administration', date: '1962-10-01', region: 'western-new-guinea',
    kind: 'un-administration-start', translationKey: 'history_event_modern_wng_un_start',
    note: {
      en: 'UNTEA assumed temporary administration under the New York Agreement.',
      id: 'UNTEA mengambil alih pemerintahan sementara berdasarkan Persetujuan New York.'
    }, sources: [MODERN_STATUS_SOURCES.newYorkAgreement, MODERN_STATUS_SOURCES.westNewGuineaChronology]
  },
  {
    id: 'untea-transfers-west-new-guinea-to-indonesia', date: '1963-05-01', region: 'western-new-guinea',
    kind: 'administration-transfer', translationKey: 'history_event_modern_wng_transfer',
    note: {
      en: 'UNTEA transferred administration to Indonesia under the New York Agreement.',
      id: 'UNTEA menyerahkan pemerintahan kepada Indonesia berdasarkan Persetujuan New York.'
    }, sources: [MODERN_STATUS_SOURCES.newYorkAgreement, MODERN_STATUS_SOURCES.westNewGuineaChronology]
  },
  {
    id: 'west-new-guinea-act-of-free-choice', date: '1969-07-14', region: 'western-new-guinea',
    kind: 'contested-political-process', translationKey: 'history_event_modern_wng_act_free_choice',
    note: {
      en: 'A representative-council Act of Free Choice ran 14 July–2 August 1969 and remains disputed. UNGA Resolution 2504 acknowledged completion of the UN’s assigned role; it did not determine that the process was fair.',
      id: 'Penentuan Pendapat Rakyat melalui Dewan Musyawarah berlangsung 14 Juli–2 Agustus 1969 dan tetap diperdebatkan. Resolusi MU PBB 2504 mencatat selesainya tugas PBB, bukan putusan bahwa prosesnya adil.'
    }, sources: [MODERN_STATUS_SOURCES.actOfFreeChoiceResolution, MODERN_STATUS_SOURCES.newYorkAgreement, MODERN_STATUS_SOURCES.westNewGuineaChronology]
  },
  {
    id: 'indonesia-invades-east-timor', date: '1975-12-07', region: 'timor-leste',
    kind: 'invasion', translationKey: 'history_event_modern_timor_invasion',
    note: {
      en: 'Indonesian forces invaded East Timor. This marks the start of occupation, not a recognized transfer of sovereignty.',
      id: 'Pasukan Indonesia menginvasi Timor Timur. Peristiwa ini menandai awal pendudukan, bukan penyerahan kedaulatan yang diakui.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'indonesia-annexes-east-timor-unrecognized', date: '1976-07-17', region: 'timor-leste',
    kind: 'unrecognized-annexation', translationKey: 'history_event_modern_timor_annexation',
    note: {
      en: 'Indonesia declared annexation; the United Nations did not recognize it. The occupation status remains distinct from accepted sovereignty.',
      id: 'Indonesia menyatakan aneksasi; Perserikatan Bangsa-Bangsa tidak mengakuinya. Status pendudukan tetap dibedakan dari kedaulatan yang diterima.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'east-timor-rejects-autonomy', date: '1999-08-30', region: 'timor-leste',
    kind: 'referendum', translationKey: 'history_event_modern_timor_referendum',
    note: {
      en: 'In the UN-organized ballot, voters rejected the autonomy proposal within Indonesia. Withdrawal and UN transitional administration followed later that year.',
      id: 'Dalam pemungutan suara yang diselenggarakan PBB, pemilih menolak usulan otonomi di dalam Indonesia. Penarikan pasukan dan pemerintahan transisi PBB menyusul pada tahun yang sama.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'untaet-begins-east-timor-administration', date: '1999-10-25', region: 'timor-leste',
    kind: 'un-transition-administration', translationKey: 'history_event_modern_timor_un_start',
    note: {
      en: 'UNTAET assumed transitional administration; this did not itself confer independence.',
      id: 'UNTAET mengambil alih pemerintahan transisi; peristiwa ini tidak dengan sendirinya memberikan kemerdekaan.'
    }, sources: [MODERN_STATUS_SOURCES.untaetResolution, MODERN_STATUS_SOURCES.eastTimorChronology]
  },
  {
    id: 'indonesian-withdrawal-east-timor-complete', date: '1999-10-31', region: 'timor-leste',
    kind: 'withdrawal-complete', translationKey: 'history_event_modern_timor_withdrawal',
    note: {
      en: 'Indonesian forces completed withdrawal. UN transitional administration continued until independence in 2002.',
      id: 'Pasukan Indonesia menyelesaikan penarikan. Pemerintahan transisi PBB berlanjut hingga kemerdekaan pada 2002.'
    }, sources: [MODERN_STATUS_SOURCES.eastTimorChronology, MODERN_STATUS_SOURCES.untaetResolution]
  },
  {
    id: 'timor-leste-independence', date: '2002-05-20', region: 'timor-leste',
    kind: 'independence', translationKey: 'history_event_modern_timor_independence',
    note: {
      en: 'Timor-Leste became independent after UNTAET transitional administration.',
      id: 'Timor-Leste merdeka setelah pemerintahan transisi UNTAET.'
    }, sources: [...TIMOR_TRANSITION_SOURCES]
  }
];

/** Return the phase in effect for a year after that year's major transition. */
export function modernTerritorialStatusAt(region: ModernRegionId, year: number): ModernStatusPhase | undefined {
  if (!Number.isInteger(year) || year < 1945 || year > HISTORY_PRESENT_YEAR) return undefined;
  return MODERN_STATUS_PHASES.find(phase => phase.region === region && phase.annualFrom <= year && year <= phase.annualTo);
}

/** Exact-dated milestones for a calendar year, ordered by date. */
export function modernMilestonesAt(year: number): readonly ModernMilestone[] {
  if (!Number.isInteger(year)) return [];
  return MODERN_MILESTONES.filter(milestone => Number(milestone.date.slice(0, 4)) === year)
    .sort((first, second) => first.date.localeCompare(second.date));
}
