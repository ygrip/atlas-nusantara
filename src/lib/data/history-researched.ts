import type { HistoricalPolity } from './history.ts';

/** Additional research overviews. Bounds mark evidence/display intervals, not proven foundations. */
export const RESEARCHED_POLITIES: HistoricalPolity[] = [
  {
    id: 'adonara', name: 'Kerajaan Adonara', from: 1650, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Adonara, East Flores', placeId: 'Adonara, Flores Timur',
    summary: {
      en: 'A principality on Adonara in the eastern Flores island network. Local historical accounts associate its later royal centre with Sagu; the early chronology needs comparison with archival evidence.',
      id: 'Kerajaan di Adonara dalam jaringan kepulauan Flores timur. Riwayat setempat menghubungkan pusat kerajaan kemudian dengan Sagu; kronologi awalnya perlu dibandingkan dengan bukti arsip.'
    },
    rulers: [], zones: [{ lon: 123.220, lat: -8.245, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://ejurnal.perpustakaan-undana.com/index.php/js/article/download/s434/396', 'https://mapcarta.com/29195498'],
    dateNote: {
      en: '1650 is a display approximation for a traditional 1650s chronology, not an established founding year. The point is a weakly sourced Sagu locality proxy, not a verified palace. 1944 is the atlas cutoff, not dissolution.',
      id: '1650 adalah pendekatan tampilan untuk tradisi kronologi 1650-an, bukan tahun pendirian yang pasti. Titik hanya perkiraan lokasi Sagu dengan sumber lemah, bukan istana terverifikasi. 1944 adalah batas atlas, bukan pembubaran.'
    }
  },
  {
    id: 'amanuban', name: 'Kerajaan Amanuban', from: 1600, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Niki-Niki, West Timor', placeId: 'Niki-Niki, Timor Barat',
    summary: {
      en: 'An Atoni polity associated with the Nope dynasty in south-central West Timor. Niki-Niki became a royal centre, but a modern locality point cannot establish where the court stood in earlier periods.',
      id: 'Kerajaan Atoni yang terkait dengan dinasti Nope di Timor Barat bagian tengah-selatan. Niki-Niki kemudian menjadi pusat kerajaan, tetapi titik permukiman modern tidak membuktikan lokasi istana pada masa sebelumnya.'
    },
    rulers: [], zones: [{ lon: 124.473, lat: -9.817, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://repositori.kemendikdasmen.go.id/24976/1/SEJARAH%20PERLAWANAN%20TERHADAP%20IMPERIALISME%20DAN%20KOLONIALISME%20DI%20NUSA%20TENGGARA%20TIMUR.pdf', 'https://www.wikidata.org/wiki/Q14647089'],
    dateNote: {
      en: '1600 is the lower display bound of seventeenth-century documentation, not a known foundation. Niki-Niki is an approximate later locality reference; it is not a capital claim for every year. 1944 is only the atlas cutoff.',
      id: '1600 adalah batas awal tampilan untuk dokumentasi abad ke-17, bukan tahun pendirian yang diketahui. Niki-Niki hanya acuan perkiraan lokasi kemudian, bukan klaim ibu kota setiap tahun. 1944 hanya batas atlas.'
    }
  },
  {
    id: 'amanatun', name: 'Kerajaan Amanatun', from: 1614, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Nunkolo, West Timor', placeId: 'Nunkolo, Timor Barat',
    summary: {
      en: 'A Timorese polity identified with Amenato in a Dutch report of 1614. Later colonial subordination changed its political autonomy; it should not be treated as proof that the royal institution disappeared.',
      id: 'Kerajaan Timor yang diidentifikasi dengan Amenato dalam laporan Belanda tahun 1614. Penundukan kolonial kemudian mengubah otonominya; hal itu tidak membuktikan bahwa lembaga kerajaan langsung hilang.'
    },
    rulers: [], zones: [{ lon: 124.724, lat: -9.876, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://brill.com/display/book/9789004253506/B9789004253506-s005.pdf', 'https://www.geonames.org/1633819/desa-nunkolo.html'],
    dateNote: {
      en: '1614 dates a report identifying Amenato with Amanatun, not its foundation. The coordinate identifies the modern Nunkolo locality, not a verified dated court. The 1944 end is the atlas cutoff, not dissolution.',
      id: '1614 adalah tanggal laporan yang mengidentifikasi Amenato dengan Amanatun, bukan pendiriannya. Koordinat menunjukkan lokasi Nunkolo modern, bukan istana bertanggal yang terverifikasi. Akhir 1944 adalah batas atlas, bukan pembubaran.'
    }
  },
  {
    id: 'amfoan', name: 'Kerajaan Amfoan', from: 1683, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Naikliu, West Timor', placeId: 'Naikliu, Timor Barat',
    summary: {
      en: 'A Timorese polity also known as Amfo’an or Sorbian. Its political history includes alliances with the Dutch-centred Kupang community and separate Naikliu and Timau branches, reunited in 1910.',
      id: 'Kerajaan Timor yang juga dikenal sebagai Amfo’an atau Sorbian. Sejarah politiknya mencakup hubungan dengan komunitas sekutu Belanda di Kupang serta cabang Naikliu dan Timau yang disatukan kembali pada 1910.'
    },
    rulers: [], zones: [{ lon: 123.852, lat: -9.521, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://sejarah-nusantara.anri.go.id/media/userdefined/pdf/rulersinasiav7.pdf', 'https://mapcarta.com/15614830'],
    dateNote: {
      en: '1683 marks a documented flight and political realignment, not a foundation. Branches and interrupted sovereignty are compressed in this overview. Naikliu is only a locality proxy; 1944 is the atlas cutoff.',
      id: '1683 menandai perpindahan dan perubahan hubungan politik yang tercatat, bukan pendirian. Cabang kerajaan dan perubahan kedaulatan diringkas dalam ikhtisar ini. Naikliu hanya perkiraan lokasi; 1944 adalah batas atlas.'
    }
  },
  {
    id: 'insana', name: 'Kerajaan Insana', from: 1761, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Oelolok, West Timor', placeId: 'Oelolok, Timor Barat',
    summary: {
      en: 'An Atoni princedom in north-central Timor whose ruler shared authority with territorial lineage leaders. Its political organisation cannot be reduced to the continuous territorial sovereignty of a modern state.',
      id: 'Kerajaan Atoni di Timor bagian tengah-utara yang penguasanya berbagi kewenangan dengan pemimpin kekerabatan wilayah. Susunan politiknya tidak dapat disamakan dengan kedaulatan wilayah berkesinambungan negara modern.'
    },
    rulers: [], zones: [{ lon: 124.699, lat: -9.469, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://www.jstor.org/stable/10.1163/j.ctvbqs66r', 'https://mapcarta.com/15613024'],
    dateNote: {
      en: '1761 is a documented ruler reference, not a foundation. Oelolok is an approximate locality reference rather than a verified palace. No dissolution date is inferred: 1944 is the atlas cutoff.',
      id: '1761 adalah acuan penguasa yang terdokumentasi, bukan pendirian. Oelolok merupakan perkiraan lokasi, bukan istana terverifikasi. Tidak ada tanggal pembubaran yang disimpulkan: 1944 adalah batas atlas.'
    }
  },
  {
    id: 'amarasi', name: 'Kerajaan Amarasi', from: 1658, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Baun, West Timor', placeId: 'Baun, Timor Barat',
    summary: {
      en: 'A western Timorese principality involved in changing relationships with Portuguese-aligned Topasses and the Dutch VOC. Its rulers operated within shifting local alliances rather than a fixed modern frontier.',
      id: 'Kerajaan di Timor barat yang terlibat dalam hubungan yang berubah dengan Topass sekutu Portugis dan VOC Belanda. Penguasanya bergerak dalam jaringan persekutuan setempat, bukan perbatasan modern yang tetap.'
    },
    rulers: [], zones: [{ lon: 123.725, lat: -10.294, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://brill.com/downloadpdf/display/title/23413.pdf', 'https://mapcarta.com/16459982'],
    dateNote: {
      en: '1658 is a display bound for documented seventeenth-century political activity, not a founding year. The Baun point is a modern locality proxy, not a dated historical capital. 1944 is only the atlas cutoff.',
      id: '1658 adalah batas tampilan kegiatan politik abad ke-17 yang terdokumentasi, bukan tahun pendirian. Titik Baun adalah perkiraan permukiman modern, bukan ibu kota historis bertanggal. 1944 hanya batas atlas.'
    }
  },
  {
    id: 'maubara', name: 'Kerajaan Maubara', from: 1712, to: 1944,
    category: 'regional', region: 'nusa-tenggara', place: 'Maubara, Timor-Leste', placeId: 'Maubara, Timor-Leste',
    summary: {
      en: 'A Timorese principality involved in Dutch–Portuguese rivalry. The transfer to Portuguese authority was implemented in 1861; colonial transfer did not by itself establish an end to local royal institutions.',
      id: 'Kerajaan Timor yang terlibat dalam persaingan Belanda–Portugis. Penyerahan kepada kekuasaan Portugis dilaksanakan pada 1861; perpindahan kolonial itu sendiri tidak menetapkan berakhirnya lembaga kerajaan setempat.'
    },
    rulers: [], zones: [{ lon: 125.206, lat: -8.613, radiusKm: 15, confidence: 'approximate-core' }],
    sources: ['https://www.cambridge.org/core/journals/journal-of-southeast-asian-studies/article/abs/maubara-fort-a-relic-of-eighteenthcentury-local-autonomy-and-dutchportuguese-rivalry-on-timor/DE6A04B5850E1FEB6C2A8747148D4050', 'https://mapcarta.com/15617330'],
    dateNote: {
      en: '1712 is the earliest ruler reference used here, not a known foundation. The 1859 treaty and its 1861 implementation are distinct. The coordinate is an approximate locality, not a verified court. 1944 is the atlas cutoff.',
      id: '1712 adalah acuan penguasa paling awal yang dipakai di sini, bukan pendirian yang pasti. Perjanjian 1859 berbeda dari pelaksanaannya pada 1861. Koordinat hanya perkiraan lokasi, bukan istana terverifikasi. 1944 adalah batas atlas.'
    }
  }
];
