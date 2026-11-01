/** Modern state profiles. Display years do not erase disputed or transitional regional status. */
import type { HistoricalPolity } from './history.ts';
import { HISTORY_PRESENT_YEAR, MODERN_STATUS_SOURCES } from './history-modern.ts';

const naturalEarth = 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/';
const presidents = 'https://dev-kepustakaanpresiden.perpusnas.go.id/';

export const MODERN_POLITIES: HistoricalPolity[] = [
  {
    id: 'indonesia', name: 'Indonesia', from: 1945, fromDate: '1945-08-17', to: HISTORY_PRESENT_YEAR, ongoing: true,
    category: 'republic', region: 'archipelago', place: 'Jakarta', placeId: 'Jakarta',
    summary: {
      en: 'Indonesia proclaimed independence on 17 August 1945. The 1949 Dutch sovereignty transfer was to the federal United States of Indonesia and excluded Dutch New Guinea. The modern timeline distinguishes reconstructed territory, administrative transfers and disputed occupation rather than treating every claim as effective control.',
      id: 'Indonesia memproklamasikan kemerdekaan pada 17 Agustus 1945. Penyerahan kedaulatan Belanda pada 1949 ditujukan kepada Republik Indonesia Serikat dan tidak mencakup Nugini Belanda. Linimasa modern membedakan rekonstruksi wilayah, peralihan pemerintahan, dan pendudukan yang disengketakan; klaim tidak disamakan dengan kendali efektif.'
    },
    rulers: [
      { name: 'Soekarno', from: 1945, to: 1967 },
      { name: 'Soeharto', from: 1967, to: 1998 },
      { name: 'B. J. Habibie', from: 1998, to: 1999 },
      { name: 'Abdurrahman Wahid', from: 1999, to: 2001 },
      { name: 'Megawati Soekarnoputri', from: 2001, to: 2004 },
      { name: 'Susilo Bambang Yudhoyono', from: 2004, to: 2014 },
      { name: 'Joko Widodo', from: 2014, to: 2024 },
      { name: 'Prabowo Subianto', from: 2024, ongoing: true }
    ],
    // Approximate Jakarta city centre; not the Natural Earth country-label point on Sumatra.
    zones: [{ lon: 106.8272, lat: -6.1754, radiusKm: 500, confidence: 'approximate-core' }],
    sources: [
      MODERN_STATUS_SOURCES.indonesianDeclaration, MODERN_STATUS_SOURCES.sovereigntyTransfer,
      MODERN_STATUS_SOURCES.newYorkAgreement, MODERN_STATUS_SOURCES.eastTimorChronology,
      presidents, 'https://pusdipres.anri.go.id/arsip-kepresidenan/khazanah-arsip-kepresidenan/guide-arsip-presiden-ri-sukarno-1945-1967',
      'https://pusdipres.anri.go.id/arsip-kepresidenan/khazanah-arsip-kepresidenan/guide-arsip-presiden-ke-2-ri-soeharto-1967-1998',
      'https://presidenri.go.id/siaran-pers/prabowo-subianto-dan-gibran-rakabuming-raka-resmi-dilantik-sebagai-presiden-dan-wakil-presiden-ri/',
      'https://peraturan.bpk.go.id/Download/27970/UU%20Nomor%2024%20Tahun%202009.pdf', naturalEarth
    ],
    dateNote: {
      en: 'Ongoing state; the last slider year is a display limit, not dissolution. Annual views represent the state after major transitions within the year. Soeharto’s 1967 acting presidency is not the 1966 Supersemar delegation. A planned term ending in 2029 is not recorded as a completed Prabowo presidency. The marker locates Jakarta approximately.',
      id: 'Negara masih berlangsung; tahun terakhir penggeser adalah batas tampilan, bukan pembubaran. Tampilan tahunan mewakili keadaan setelah peralihan besar pada tahun tersebut. Jabatan pejabat presiden Soeharto pada 1967 dibedakan dari pelimpahan wewenang Supersemar 1966. Rencana akhir masa jabatan 2029 tidak dicatat sebagai akhir pemerintahan Prabowo yang telah terjadi. Penanda menunjukkan perkiraan pusat Jakarta.'
    }
  },
  {
    id: 'timor-leste', name: 'Timor-Leste', from: 2002, fromDate: '2002-05-20', to: HISTORY_PRESENT_YEAR, ongoing: true,
    category: 'republic', region: 'nusa-tenggara', place: 'Timor-Leste · cartographic label point', placeId: 'Timor-Leste · titik label kartografis',
    summary: {
      en: 'Timor-Leste became independent on 20 May 2002 following UN transitional administration. Indonesian occupation began in 1975; the 1976 annexation was not recognized by the UN. The 1999 ballot and Indonesian withdrawal preceded independence and are represented as separate transitions.',
      id: 'Timor-Leste merdeka pada 20 Mei 2002 setelah pemerintahan transisi PBB. Pendudukan Indonesia dimulai pada 1975; aneksasi 1976 tidak diakui PBB. Jajak pendapat 1999 dan penarikan Indonesia mendahului kemerdekaan dan ditampilkan sebagai peralihan yang terpisah.'
    },
    rulers: [
      { name: 'Xanana Gusmão', from: 2002, to: 2007 },
      { name: 'José Ramos-Horta', from: 2007, to: 2012 },
      { name: 'José Ramos-Horta', from: 2022, ongoing: true }
    ],
    zones: [{ lon: 125.854679, lat: -8.803705, radiusKm: 35, confidence: 'approximate-core' }],
    sources: [
      MODERN_STATUS_SOURCES.eastTimorChronology, MODERN_STATUS_SOURCES.untaetResolution,
      MODERN_STATUS_SOURCES.unmissetBackground, 'https://timor-leste.gov.tl/?lang=en&p=1602',
      'https://presidenciarepublica.tl/about-president-jose-ramos-horta/', naturalEarth
    ],
    dateNote: {
      en: 'The 1999 withdrawal and UN transition are not the 2002 independence date. Occupation and unrecognized annexation are not described as ordinary provincial membership or secession. The country remains independent; leaders shown are selected examples, not a complete presidency list. Country label coordinates are not capital coordinates.',
      id: 'Penarikan Indonesia dan transisi PBB pada 1999 bukan tanggal kemerdekaan 2002. Pendudukan dan aneksasi yang tidak diakui tidak disebut keanggotaan atau pemisahan provinsi biasa. Negara tetap merdeka; pemimpin yang ditampilkan adalah contoh terpilih, bukan daftar seluruh presiden. Titik label negara bukan koordinat ibu kota.'
    }
  }
];

export const MODERN_TIMELINE_EVENTS = [
  { year: 1945, en: '17 August: Indonesia proclaims independence; declaration is not a map of effective control', id: '17 Agustus: Indonesia memproklamasikan kemerdekaan; deklarasi bukan peta kendali efektif' },
  { year: 1949, en: 'Dutch sovereignty transfer to federal Indonesia excludes Dutch New Guinea', id: 'Penyerahan kedaulatan kepada RIS tidak mencakup Nugini Belanda' },
  { year: 1962, en: 'UNTEA begins temporary administration of West New Guinea', id: 'UNTEA mulai memerintah sementara Nugini Barat' },
  { year: 1963, en: '1 May: administration of West New Guinea transfers to Indonesia', id: '1 Mei: pemerintahan Nugini Barat beralih kepada Indonesia' },
  { year: 1969, en: 'Representative-council Act of Free Choice; the process remains disputed', id: 'Penentuan Pendapat Rakyat melalui dewan musyawarah; prosesnya tetap diperdebatkan' },
  { year: 1975, en: '7 December: Indonesian invasion of East Timor', id: '7 Desember: invasi Indonesia ke Timor Timur' },
  { year: 1976, en: 'Indonesia annexes East Timor; the UN does not recognize the annexation', id: 'Indonesia menganeksasi Timor Timur; PBB tidak mengakui aneksasi tersebut' },
  { year: 1999, en: 'East Timor ballot, Indonesian withdrawal and UN transitional administration', id: 'Jajak pendapat Timor Timur, penarikan Indonesia, dan pemerintahan transisi PBB' },
  { year: 2002, en: '20 May: Timor-Leste becomes independent', id: '20 Mei: Timor-Leste merdeka' }
] as const;
