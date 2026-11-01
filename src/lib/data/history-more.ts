import type { HistoricalPolity } from './history';

/**
 * Additional pre-1945 polities, researched from the cited sources. Same caveats
 * as history.ts: dates are approximate and each zone is a schematic halo, never
 * a surveyed border. Where a source gives only a century or a tradition, the
 * dateNote says so and the earliest/latest sourced year is used.
 */
export const MORE_POLITIES: HistoricalPolity[] = [
  {
    id: "galuh",
    name: "Kerajaan Galuh",
    from: 670,
    to: 1528,
    category: "hindu-buddhist",
    region: "java",
    place: "Karangkamulyan / Kawali, Ciamis, West Java",
    placeId: "Karangkamulyan / Kawali, Ciamis, Jawa Barat",
    summary: {
      en: "A West Javanese Sundanese kingdom that separated from Tarumanagara around 670 and was absorbed into Demak in 1528.",
      id: "Kerajaan Sunda di Jawa Barat yang memisahkan diri dari Tarumanegara sekitar 670 dan bergabung ke Demak pada 1528."
    },
    rulers: [],
    zones: [
      {
        lon: 108.33361,
        lat: -7.32806,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Galuh"
    ],
    dateNote: {
      en: "Id.wiki infobox gives 670 (separation from Tarumanagara) to 1528 (Demak). Seats: Karangkamulyan (612-702), Saunggalah, Kawali (1311-1482). Zone uses Ciamis town from en.wiki. Overlaps the existing sunda record; the dataset owner should decide. Only one source opened.",
      id: "Infobox id.wiki memberi 670 (pemisahan dari Tarumanagara) hingga 1528 (Demak). Pusat: Karangkamulyan (612-702), Saunggalah, Kawali (1311-1482). Zona memakai kota Ciamis dari en.wiki. Tumpang tindih dengan rekaman sunda; keputusan ada pada pemilik dataset. Hanya satu sumber yang dibuka."
    }
  },
  {
    id: "kanjuruhan",
    name: "Kerajaan Kanjuruhan",
    from: 700,
    to: 800,
    category: "hindu-buddhist",
    region: "java",
    place: "Malang, East Java (Dinoyo)",
    placeId: "Malang, Jawa Timur (Dinoyo)",
    summary: {
      en: "An East Javan kingdom near Malang, dated from the 7th century and absorbed into Mataram in the 8th century.",
      id: "Kerajaan di Jawa Timur dekat Malang, bermula abad ke-7 dan digabung ke Mataram pada abad ke-8."
    },
    rulers: [
      {
        name: "Dewasimha",
        from: 700,
        to: 760
      },
      {
        name: "Gajayana",
        from: 760,
        to: 789
      }
    ],
    zones: [
      {
        lon: 112.62,
        lat: -7.98,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Kanjuruhan"
    ],
    dateNote: {
      en: "Relaxed date handling: 'abad ke-7' is set to 700 and 'abad ke-8' to 800 as approximations. Id.wiki infobox says founded in the 7th century, text says 8th century. Ruler years are from id.wiki. Zone uses Malang city centre; Dinoyo is not coordinated. Only one source opened.",
      id: "Penanganan tanggal longgar: 'abad ke-7' ditetapkan 700 dan 'abad ke-8' ditetapkan 800 sebagai perkiraan. Infobox id.wiki menyebut didirikan abad ke-7, teks menyebut abad ke-8. Tahun raja dari id.wiki. Zona memakai pusat kota Malang; Dinoyo tidak punya koordinat. Hanya satu sumber yang dibuka."
    }
  },
  {
    id: "tanjungpura",
    name: "Kerajaan Tanjungpura (Sukadana)",
    from: 701,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Sukadana, Kayong Utara, West Kalimantan",
    placeId: "Sukadana, Kayong Utara, Kalimantan Barat",
    summary: {
      en: "The Tanjungpura kingdom of West Kalimantan, which moved its capital to Sukadana in the 14th century after its ruler converted to Islam; later Sukadana and Matan centred the line.",
      id: "Kerajaan Tanjungpura di Kalimantan Barat, memindahkan ibu kota ke Sukadana pada abad ke-14 setelah rajanya memeluk Islam; kemudian Sukadana dan Matan menjadi pusat garis ini."
    },
    rulers: [
      {
        name: "Sultan Muhammad Zainuddin",
        to: 1724
      }
    ],
    zones: [
      {
        lon: 109.949479,
        lat: -1.237165,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Tanjungpura",
      "https://id.wikipedia.org/wiki/Sukadana,_Kayong_Utara"
    ],
    dateNote: {
      en: "Start 701 = earliest year of the 'abad ke-8' date in the source (relaxed rule). Early history is partly legendary; the source has no end date, so 'to' is set to the 1944 cap. Ruler Zainuddin reign per source. Matan and Sukadana fall under this entry. Centre = Sukadana town.",
      id: "Start 701 = earliest year of the 'abad ke-8' date in the source (relaxed rule). Early history is partly legendary; the source has no end date, so 'to' is set to the 1944 cap. Ruler Zainuddin reign per source. Matan and Sukadana fall under this entry. Centre = Sukadana town."
    }
  },
  {
    id: "lamuri",
    name: "Kerajaan Lamuri",
    from: 800,
    to: 1503,
    category: "islamic",
    region: "sumatra",
    place: "Lamreh, Aceh Besar, Aceh",
    placeId: "Lamreh, Kabupaten Aceh Besar, Aceh",
    summary: {
      en: "A north-Sumatran kingdom centred at Lamreh in Aceh Besar. Its Islamic phase is attested by gravestones, and it was absorbed into Aceh in the early 16th century.",
      id: "Kerajaan di Sumatra utara yang berpusat di Lamreh, Aceh Besar. Fase Islamnya tercatat pada batu nisan, dan kerajaan ini digabung ke Aceh pada awal abad ke-16."
    },
    rulers: [],
    zones: [
      {
        lon: 95.533,
        lat: 5.367,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Lamuri"
    ],
    dateNote: {
      en: "Id.wiki infobox gives 800 as founding; its text says the kingdom existed from the mid-9th century, so 800 is an approximation. End 1503 is the infobox's Aceh-emergence date; the text says merged in 1513. Zone uses the Aceh Besar regency centroid. Only one source was opened; the scholarly ScienceDirect article returned 403.",
      id: "Infobox id.wiki memberi 800 sebagai pendirian; teksnya menyebut kerajaan ada sejak abad ke-9, sehingga 800 adalah perkiraan. Akhir 1503 adalah tanggal munculnya Aceh pada infobox; teks menyebut penggabungan 1513. Zona memakai pusat Kabupaten Aceh Besar. Hanya satu sumber yang dibuka; artikel ScienceDirect mengembalikan 403."
    }
  },
  {
    id: "perlak",
    name: "Kesultanan Perlak",
    from: 840,
    to: 1292,
    category: "islamic",
    region: "sumatra",
    place: "Peureulak, East Aceh Regency, Aceh",
    placeId: "Peureulak, Kabupaten Aceh Timur, Aceh",
    summary: {
      en: "An early Islamic sultanate on Sumatra's northeast coast, dated 840 to 1292 and merged into Samudera Pasai in 1292.",
      id: "Kesultanan Islam awal di pantai timur laut Sumatra, tercatat 840 hingga 1292 dan digabung ke Samudera Pasai pada 1292."
    },
    rulers: [
      {
        name: "Sultan Alaiddin Syed Maulana Abdul Aziz Shah",
        from: 840,
        to: 864
      },
      {
        name: "Sultan Makhdum Alaiddin Malik Abdul Aziz Johan Berdaulat",
        from: 1267,
        to: 1292
      }
    ],
    zones: [
      {
        lon: 97.617,
        lat: 4.617,
        radiusKm: 60,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Peureulak",
      "https://en.wikipedia.org/wiki/Peureulak"
    ],
    dateNote: {
      en: "Id.wiki gives 840-1292 and the 1 Muharram 225 H (840) founding; en.wiki gives the same span. Ruler years conflict: id.wiki gives 860-864 for Abdul Aziz Shah, en.wiki gives 840-864. Zone uses East Aceh regency centroid. No official source opened.",
      id: "id.wiki memberi 840-1292 dan pendirian 1 Muharram 225 H (840); en.wiki memberi rentang yang sama. Tahun pemerintahan berbeda: id.wiki 860-864 untuk Abdul Aziz Shah, en.wiki 840-864. Zona memakai pusat Kabupaten Aceh Timur. Belum ada sumber resmi yang dibuka."
    }
  },
  {
    id: "janggala",
    name: "Kerajaan Janggala",
    from: 1042,
    to: 1135,
    category: "hindu-buddhist",
    region: "java",
    place: "Porong, Sidoarjo, East Java",
    placeId: "Porong, Kabupaten Sidoarjo, Jawa Timur",
    summary: {
      en: "A successor state split from Kahuripan in 1042 and absorbed by Kediri around 1135.",
      id: "Negara penerus yang terpisah dari Kahuripan pada 1042 dan diserap Kediri sekitar 1135."
    },
    rulers: [
      {
        name: "Mapanji Garasakan",
        from: 1042,
        to: 1052
      },
      {
        name: "Alanjung Ahyes",
        from: 1052,
        to: 1059
      }
    ],
    zones: [
      {
        lon: 112.685653,
        lat: -7.53966,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Janggala"
    ],
    dateNote: {
      en: "Id.wiki gives 1042 founding and 1135 absorption into Kediri (prasasti Ngantang). Id.wiki says the centre is around Porong, Sidoarjo. Zone uses Porong from en.wiki. Only one source opened. Overlaps the existing kediri and kahuripan records.",
      id: "id.wiki memberi pendirian 1042 dan penyerapan ke Kediri 1135 (prasasti Ngantang). id.wiki menyebut pusat sekitar Porong, Sidoarjo. Zona memakai Porong dari en.wiki. Hanya satu sumber yang dibuka. Tumpang tindih dengan rekaman kediri dan kahuripan."
    }
  },
  {
    id: "bolaang-mongondow",
    name: "Kerajaan Bolaang Mongondow",
    from: 1101,
    to: 1944,
    category: "regional",
    region: "sulawesi",
    place: "Kotamobagu / Bolaang coast, North Sulawesi",
    placeId: "Kotamobagu / pesisir Bolaang, Sulawesi Utara",
    summary: {
      en: "A North Sulawesi kingdom of the Mongondow people, documented from the 12th to the 20th century, centred on the Bolaang north coast and Mongondow near Kotamobagu.",
      id: "Kerajaan suku Mongondow di Sulawesi Utara, tercatat dari abad ke-12 hingga abad ke-20, berpusat di pesisir utara Bolaang dan Mongondow sekitar Kotamobagu."
    },
    rulers: [],
    zones: [
      {
        lon: 124.32,
        lat: 0.73,
        radiusKm: 50,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Bolaang_Mongondow",
      "https://id.wikipedia.org/wiki/Kota_Kotamobagu"
    ],
    dateNote: {
      en: "'Abad ke-12' start, earliest year = 1101 (relaxed rule). 'Abad ke-20' end is capped to 1944. Centre = Kotamobagu city (modern seat), not the Bolaang palace site.",
      id: "'Abad ke-12' start, earliest year = 1101 (relaxed rule). 'Abad ke-20' end is capped to 1944. Centre = Kotamobagu city (modern seat), not the Bolaang palace site."
    }
  },
  {
    id: "melayu-dharmasraya",
    name: "Kerajaan Melayu (Dharmasraya)",
    from: 1183,
    to: 1347,
    category: "hindu-buddhist",
    region: "sumatra",
    place: "Dharmasraya Regency, West Sumatra",
    placeId: "Kabupaten Dharmasraya, Sumatera Barat",
    summary: {
      en: "A Malayu polity in central Sumatra, attested by the Padang Roco statue inscription of 1286 under Tribhuwanaraja.",
      id: "Kerajaan Melayu di Sumatra tengah, tercatat melalui prasasti arca Padang Roco tahun 1286 pada masa Tribhuwanaraja."
    },
    rulers: [
      {
        name: "Sri Maharaja Srimat Tribhuwanaraja Mauliwarmmadewa",
        from: 1286,
        to: 1316
      }
    ],
    zones: [
      {
        lon: 101.367,
        lat: -1.05,
        radiusKm: 80,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Dharmasraya",
      "https://www.kompas.com/stori/read/2022/08/21/120000879/prasasti-padang-roco-hadiah-raja-singasari-untuk-kerajaan-dharmasraya"
    ],
    dateNote: {
      en: "Start 1183 and end 1347 are the infobox's approximate dates (sk.). The Padang Roco site is in Siguntur; the zone uses the regency centroid, not the site. Reign 1286-1316 from Kompas. No scholarly second source opened.",
      id: "Awal 1183 dan akhir 1347 adalah perkiraan (sk.) dari infobox. Situs Padang Roco ada di Siguntur; zona memakai pusat kabupaten, bukan situs. Masa pemerintahan 1286-1316 dari Kompas. Belum ada sumber ilmiah kedua yang dibuka."
    }
  },
  {
    id: "jailolo",
    name: "Kesultanan Jailolo",
    from: 1201,
    to: 1832,
    category: "islamic",
    region: "maluku",
    place: "Jailolo, West Halmahera",
    placeId: "Jailolo, Halmahera Barat",
    summary: {
      en: "One of the four Maluku sultanates of Moloku Kie Raha, centred on Jailolo bay in west Halmahera. It was subordinated to Ternate in 1551, and its last ruler was removed by the Dutch in 1832.",
      id: "Salah satu dari empat kesultanan Moloku Kie Raha, berpusat di teluk Jailolo, Halmahera Barat. Ditaklukkan Ternate pada 1551, dan penguasa terakhirnya dilengserkan Belanda pada 1832."
    },
    rulers: [
      {
        name: "Katarabumi",
        from: 1536,
        to: 1551
      },
      {
        name: "Muhammad Asgar",
        from: 1825,
        to: 1832
      }
    ],
    zones: [
      {
        lon: 127.5,
        lat: 1.083,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Jailolo",
      "https://en.wikipedia.org/wiki/Sultanate_of_Jailolo",
      "https://en.wikipedia.org/wiki/Jailolo_(town)"
    ],
    dateNote: {
      en: "Source says the sultanate was founded 'abad ke-13' (13th century). Per relaxed rule, from = 1201, the earliest year of that century; 1500s start not sourced. End 1832 per source. Coordinates from Jailolo town (en Wikipedia), the modern seat.",
      id: "Source says the sultanate was founded 'abad ke-13' (13th century). Per relaxed rule, from = 1201, the earliest year of that century; 1500s start not sourced. End 1832 per source. Coordinates from Jailolo town (en Wikipedia), the modern seat."
    }
  },
  {
    id: "aru",
    name: "Kerajaan Aru (Haru)",
    from: 1225,
    to: 1613,
    category: "islamic",
    region: "sumatra",
    place: "Deli Tua area, North Sumatra",
    placeId: "Kawasan Deli Tua, Sumatera Utara",
    summary: {
      en: "A northeast-Sumatran kingdom (Haru) dated around 1225 to 1613, defeated by Aceh in 1613. Its seat is disputed among scholars.",
      id: "Kerajaan Sumatra timur laut (Haru) sekitar 1225 hingga 1613, dikalahkan Aceh pada 1613. Lokasi pusatnya diperdebatkan sarjana."
    },
    rulers: [
      {
        name: "Raja Serbanyaman",
        from: 1225,
        to: 1255
      },
      {
        name: "Raja Kembat",
        from: 1255,
        to: 1292
      },
      {
        name: "Sultan Husin",
        from: 1410,
        to: 1456
      },
      {
        name: "Sultan Mansur Shah",
        from: 1456,
        to: 1477
      },
      {
        name: "Sultan Ali Boncar",
        from: 1477,
        to: 1500
      },
      {
        name: "Sultan Abdullah bin Alaudin",
        from: 1564,
        to: 1599
      }
    ],
    zones: [
      {
        lon: 98.67389,
        lat: 3.58944,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Aru"
    ],
    dateNote: {
      en: "Id.wiki gives founding about 1225 and defeat by Aceh in 1613; the ruler dates are approximate. Deli Tua has no coordinates on en.wiki, so zone uses Medan as proxy. Only one source opened.",
      id: "id.wiki memberi pendirian sekitar 1225 dan kekalahan oleh Aceh 1613; tanggal raja bersifat perkiraan. Deli Tua tidak punya koordinat di en.wiki, sehingga zona memakai Medan sebagai proksi. Hanya satu sumber yang dibuka."
    }
  },
  {
    id: "sumenep",
    name: "Kadipaten Sumenep",
    from: 1269,
    to: 1883,
    category: "regional",
    region: "java",
    place: "Sumenep, Madura (East Java)",
    placeId: "Sumenep, Madura, Jawa Timur",
    summary: {
      en: "A Madurese principality founded in 1269 and ended as a monarchy in 1883 when Sumenep became a regency under the Dutch.",
      id: "Kadipaten Madura yang didirikan 1269 dan berakhir sebagai monarki pada 1883 ketika Sumenep menjadi kabupaten di bawah Belanda."
    },
    rulers: [
      {
        name: "Aria Wiraraja I",
        from: 1269,
        to: 1292
      },
      {
        name: "Aria Wiraraja II",
        from: 1292,
        to: 1301
      },
      {
        name: "Aria Danurwendo",
        from: 1301,
        to: 1311
      },
      {
        name: "Aria Assrapati",
        from: 1311,
        to: 1319
      },
      {
        name: "Panembahan Joharsari",
        from: 1319,
        to: 1331
      },
      {
        name: "Panembahan Mandaraga",
        from: 1331,
        to: 1339
      }
    ],
    zones: [
      {
        lon: 113.867,
        lat: -7.017,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kadipaten_Sumenep",
      "https://sumenepkab.go.id/berita/baca/-sejarah-singkat-berakhirnya-dinasti-saut"
    ],
    dateNote: {
      en: "Id.wiki gives 1269 founding and 1883 abolition. The official Sumenep page gives no founding year and no end year, only that monarchy ended after Panembahan Muhammad Shaleh. Ruler years are from id.wiki. Zone uses the Sumenep regency centroid from en.wiki.",
      id: "id.wiki memberi 1269 pendirian dan 1883 penghapusan. Halaman resmi Sumenep tidak memberi tahun pendirian maupun akhir, hanya menyebut monarki berakhir setelah Panembahan Muhammad Shaleh. Tahun raja dari id.wiki. Zona memakai pusat Kabupaten Sumenep dari en.wiki."
    }
  },
  {
    id: "landak",
    name: "Kerajaan Landak",
    from: 1292,
    to: 1944,
    category: "regional",
    region: "borneo",
    place: "Ngabang, Landak, West Kalimantan",
    placeId: "Ngabang, Landak, Kalimantan Barat",
    summary: {
      en: "A Dayak-Malay principality in West Kalimantan, founded in 1292 and later a vassal of Banjar, Banten and the Dutch, seated at Ngabang from 1768.",
      id: "Kerajaan Dayak-Melayu di Kalimantan Barat, didirikan 1292 dan kemudian vasal Banjar, Banten dan Belanda, berpusat di Ngabang sejak 1768."
    },
    rulers: [],
    zones: [
      {
        lon: 109.94683403,
        lat: 0.39062719,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Landak",
      "https://id.wikipedia.org/wiki/Ngabang,_Landak"
    ],
    dateNote: {
      en: "Founded 1292 per infobox; 1962 end capped to 1944. Seat moved over time (Ningrat Batur, Mungguk Ayu, Bandong, Ngabang). Centre = Ngabang town (seat from 1768).",
      id: "Founded 1292 per infobox; 1962 end capped to 1944. Seat moved over time (Ningrat Batur, Mungguk Ayu, Bandong, Ngabang). Centre = Ngabang town (seat from 1768)."
    }
  },
  {
    id: "luwu",
    name: "Kedatuan Luwu",
    from: 1300,
    to: 1944,
    category: "islamic",
    region: "sulawesi",
    place: "Palopo, South Sulawesi",
    placeId: "Palopo, Sulawesi Selatan",
    summary: {
      en: "A Bugis-Toraja polity in north South Sulawesi, traditionally dated from 1300 and with Palopo as its seat, which became a kedatuan under the Dutch and was dissolved in 1954.",
      id: "Kerajaan Bugis-Toraja di Sulawesi Selatan utara, dari 1300 menurut tradisi, berpusat di Palopo, dan dibubarkan 1954."
    },
    rulers: [],
    zones: [
      {
        lon: 120.2,
        lat: -3,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kedatuan_Luwu",
      "https://id.wikipedia.org/wiki/Kota_Palopo"
    ],
    dateNote: {
      en: "1300–1954 per infobox (start traditional; end capped to 1944). Centre = Palopo city, the infobox capital; coordinates rounded to 3°S 120.2°E per Wikipedia.",
      id: "1300–1954 per infobox (start traditional; end capped to 1944). Centre = Palopo city, the infobox capital; coordinates rounded to 3°S 120.2°E per Wikipedia."
    }
  },
  {
    id: "bacan",
    name: "Kesultanan Bacan",
    from: 1322,
    to: 1944,
    category: "islamic",
    region: "maluku",
    place: "Labuha, Bacan Island, South Halmahera",
    placeId: "Labuha, Pulau Bacan, Halmahera Selatan",
    summary: {
      en: "A Malukan sultanate on Bacan Island that grew with the spice trade, was briefly Portuguese-aligned under Dom João Hairun, and was placed under Dutch vassalage in 1609. Its seat moved to the Labuha area.",
      id: "Kesultanan Maluku di Pulau Bacan yang tumbuh bersama perdagangan rempah, sempat bersekutu dengan Portugis di bawah Dom João Hairun, dan menjadi vasal Belanda pada 1609. Pusatnya pindah ke kawasan Labuha."
    },
    rulers: [
      {
        name: "Dom João Hairun",
        from: 1557,
        to: 1577
      }
    ],
    zones: [
      {
        lon: 127.48056,
        lat: -0.62778,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Sultanate_of_Bacan",
      "https://en.wikipedia.org/wiki/Labuha"
    ],
    dateNote: {
      en: "1322 is the founding date that Valentijn (1724) reports, and the infobox marks it '1322?'. The source places the palace at Amassing, near Labuha; Labuha coordinates are used as the town seat. End is capped at 1944; the source gives 1965.",
      id: "1322 is the founding date that Valentijn (1724) reports, and the infobox marks it '1322?'. The source places the palace at Amassing, near Labuha; Labuha coordinates are used as the town seat. End is capped at 1944; the source gives 1965."
    }
  },
  {
    id: "buton",
    name: "Kesultanan Buton",
    from: 1332,
    to: 1944,
    category: "islamic",
    region: "sulawesi",
    place: "Baubau, Buton island, Southeast Sulawesi",
    placeId: "Kota Baubau, Pulau Buton, Sulawesi Tenggara",
    summary: {
      en: "A sultanate on Buton island with its seat at Baubau and the Wolio-language court from 1332 and continuing to 1960.",
      id: "Kesultanan di Pulau Buton dengan pusat di Baubau dan istana berbahasa Wolio; dicatat sejak 1332 dan berlanjut hingga 1960."
    },
    rulers: [],
    zones: [
      {
        lon: 122.6058,
        lat: -5.4622,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Buton",
      "https://id.wikipedia.org/wiki/Kota_Baubau"
    ],
    dateNote: {
      en: "1332–1960 per infobox; end capped to 1944. Centre = Baubau city, the infobox capital.",
      id: "1332–1960 per infobox; end capped to 1944. Centre = Baubau city, the infobox capital."
    }
  },
  {
    id: "inderapura",
    name: "Kerajaan Inderapura",
    from: 1347,
    to: 1792,
    category: "islamic",
    region: "sumatra",
    place: "Inderapura, Pesisir Selatan Regency, West Sumatra",
    placeId: "Inderapura, Kabupaten Pesisir Selatan, Sumatera Barat",
    summary: {
      en: "A coastal kingdom on Sumatra's west coast in the Minangkabau rantau, traditionally dated 1347 to 1792.",
      id: "Kerajaan pesisir di pantai barat Sumatra di rantau Minangkabau, secara tradisional bertarikh 1347 hingga 1792."
    },
    rulers: [],
    zones: [
      {
        lon: 100.567,
        lat: -1.35,
        radiusKm: 50,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Inderapura"
    ],
    dateNote: {
      en: "Id.wiki infobox gives 1347 start and 1792 end, both approximate. The ruler list has no reign spans. Zone uses the Pesisir Selatan regency centroid; Inderapura has no separate coordinates. Only one source opened.",
      id: "Infobox id.wiki memberi awal 1347 dan akhir 1792, keduanya perkiraan. Daftar raja tanpa rentang masa pemerintahan. Zona memakai pusat Kabupaten Pesisir Selatan; Inderapura tidak punya koordinat terpisah. Hanya satu sumber yang dibuka."
    }
  },
  {
    id: "kaimana-sran",
    name: "Kerajaan Kaimana (Sran)",
    from: 1348,
    to: 1944,
    category: "regional",
    region: "papua",
    place: "Kaimana, Triton Bay, south-west Papua",
    placeId: "Kaimana, Teluk Triton, Papua Barat Daya",
    summary: {
      en: "A Sran kingdom on Triton Bay, later Islamised and linked to Tidore and Namatota. Local history records ruler Woran for 1348-1440, and Dutch-appointed rulers governed the area from 1923.",
      id: "Kerajaan Sran di Teluk Triton, kemudian memeluk Islam dan terhubung dengan Tidore dan Namatota. Sejarah lokal mencatat penguasa Woran pada 1348-1440, dan raja yang diangkat Belanda memerintah sejak 1923."
    },
    rulers: [
      {
        name: "Woran",
        from: 1348,
        to: 1440
      }
    ],
    zones: [
      {
        lon: 133.69528,
        lat: -3.64444,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Kaimana",
      "https://en.wikipedia.org/wiki/Kaimana"
    ],
    dateNote: {
      en: "Start 1348 is the first ruler's reign start from local history (Rat Sran tradition, cited in the source); the source flags later rulers as undocumented. End capped at 1944; source gives Ahmad Aituarauw's rule to 1966. Coordinates are Kaimana town, the modern seat.",
      id: "Start 1348 is the first ruler's reign start from local history (Rat Sran tradition, cited in the source); the source flags later rulers as undocumented. End capped at 1944; source gives Ahmad Aituarauw's rule to 1966. Coordinates are Kaimana town, the modern seat."
    }
  },
  {
    id: "sintang",
    name: "Kesultanan Sintang",
    from: 1365,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Sintang, West Kalimantan",
    placeId: "Sintang, Kalimantan Barat",
    summary: {
      en: "A kingdom on the Kapuas river at Sintang, Hindu before becoming Islamic, whose rulers are listed in unbroken succession; it joined Indonesia in 1950.",
      id: "Kerajaan di sungai Kapuas, Sintang, awalnya Hindu lalu menjadi Islam; daftar penguasanya disusun berkesinambungan; bergabung dengan Indonesia pada 1950."
    },
    rulers: [],
    zones: [
      {
        lon: 111.4981,
        lat: 0.0681,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Sintang",
      "https://id.wikipedia.org/wiki/Kabupaten_Sintang"
    ],
    dateNote: {
      en: "1365 start per infobox ('Awal berdiri'). The source lists rulers without reign years, so none are given. End capped to 1944 from 1950. Centre = Sintang regency seat (regency coordinates), not a verified palace site.",
      id: "1365 start per infobox ('Awal berdiri'). The source lists rulers without reign years, so none are given. End capped to 1944 from 1950. Centre = Sintang regency seat (regency coordinates), not a verified palace site."
    }
  },
  {
    id: "berau",
    name: "Kesultanan Berau",
    from: 1377,
    to: 1810,
    category: "islamic",
    region: "borneo",
    place: "Sungai Lati / Melati Jaya, Gunung Tabur, Berau, East Kalimantan",
    placeId: "Sungai Lati / Melati Jaya, Gunung Tabur, Berau, Kalimantan Timur",
    summary: {
      en: "A Sunni sultanate on the Berau river in East Kalimantan, alternately sovereign and a vassal of Brunei, Majapahit, Demak, Banjar and Gowa before ending in 1810.",
      id: "Kesultanan Sunni di sungai Berau, Kalimantan Timur, bergantian berdaulat dan menjadi vasal Brunei, Majapahit, Demak, Banjar dan Gowa sebelum berakhir 1810."
    },
    rulers: [],
    zones: [
      {
        lon: 117.68312,
        lat: 2.31141,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Berau",
      "https://id.wikipedia.org/wiki/Melati_Jaya,_Gunung_Tabur,_Berau"
    ],
    dateNote: {
      en: "Dates from infobox (1377 founding, 1810 end). Vassal periods are listed in the source. Centre = Melati Jaya village, the infobox's Sungai Lati capital.",
      id: "Dates from infobox (1377 founding, 1810 end). Vassal periods are listed in the source. Centre = Melati Jaya village, the infobox's Sungai Lati capital."
    }
  },
  {
    id: "negara-dipa",
    name: "Kerajaan Negara Dipa",
    from: 1380,
    to: 1478,
    category: "hindu-buddhist",
    region: "borneo",
    place: "Candi Laras / Amuntai area, South Kalimantan",
    placeId: "Candi Laras / Amuntai, Kalimantan Selatan",
    summary: {
      en: "A Hindu-Buddhist Banjar-region maharajadom, a vassal of Majapahit, centred near Candi Laras and Amuntai before Negara Daha succeeded it.",
      id: "Kerajaan Hindu-Buddha di wilayah Banjar, vasal Majapahit, berpusat dekat Candi Laras dan Amuntai sebelum digantikan Negara Daha."
    },
    rulers: [],
    zones: [
      {
        lon: 114.95006863,
        lat: -2.8835612,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Negara_Dipa",
      "https://id.wikipedia.org/wiki/Candi_Laras_Selatan,_Tapin"
    ],
    dateNote: {
      en: "Infobox gives 1380/87 as founding (±1387 for ruler Ampu Djatmaka) and 1478 as dissolution. Start = 1380, the earliest year in the source. Centre = Candi Laras Selatan kecamatan (modern seat near the ancient capital), not a verified palace site.",
      id: "Infobox gives 1380/87 as founding (±1387 for ruler Ampu Djatmaka) and 1478 as dissolution. Start = 1380, the earliest year in the source. Centre = Candi Laras Selatan kecamatan (modern seat near the ancient capital), not a verified palace site."
    }
  },
  {
    id: "gelgel",
    name: "Kerajaan Gelgel",
    from: 1383,
    to: 1686,
    category: "hindu-buddhist",
    region: "bali",
    place: "Gelgel, Klungkung, Bali",
    placeId: "Gelgel, Klungkung, Bali",
    summary: {
      en: "The seat of the Gelgel dynasty in Bali, which was the main court before power passed to Klungkung in 1686.",
      id: "Pusat dinasti Gelgel di Bali, pusat kerajaan utama sebelum kekuasaan beralih ke Klungkung pada 1686."
    },
    rulers: [
      {
        name: "Dalem Baturenggong",
        from: 1459,
        to: 1550
      },
      {
        name: "Dalem Bekung",
        from: 1551,
        to: 1582
      },
      {
        name: "Dalem Sagening",
        from: 1583,
        to: 1625
      }
    ],
    zones: [
      {
        lon: 115.41194,
        lat: -8.56417,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Gelgel",
      "https://gelgel.desa.id/artikel/2018/8/7/sejarah-desa-gelgel"
    ],
    dateNote: {
      en: "Id.wiki gives 1384-1686; the village page gives 1383 for Ngulesir's accession. Ruler years differ between id.wiki (Baturenggong 1459-1550) and the village page (1460-1550). Coordinates from en.wiki. Village website is not official; no scholarly source opened.",
      id: "id.wiki memberi 1384-1686; halaman desa memberi 1383 untuk naik takhta Ngulesir. Tahun pemerintahan raja berbeda antara id.wiki (Baturenggong 1459-1550) dan halaman desa (1460-1550). Koordinat dari en.wiki. Situs desa tidak resmi; belum ada sumber ilmiah yang dibuka."
    }
  },
  {
    id: "malacca-sultanate",
    name: "Kesultanan Melaka",
    from: 1400,
    to: 1511,
    category: "islamic",
    region: "malay-peninsula",
    place: "Melaka (Malacca), Malaysia",
    placeId: "Melaka, Malaysia",
    summary: {
      en: "A port sultanate on the Straits of Malacca, founded around 1400 and taken by the Portuguese in 1511.",
      id: "Kesultanan pelabuhan di Selat Melaka, didirikan sekitar 1400 dan direbut Portugis pada 1511."
    },
    rulers: [
      {
        name: "Parameswara",
        from: 1400,
        to: 1414
      },
      {
        name: "Megat Iskandar Shah",
        from: 1414,
        to: 1424
      },
      {
        name: "Muhammad Shah",
        from: 1424,
        to: 1444
      },
      {
        name: "Muzaffar Shah",
        from: 1446,
        to: 1459
      },
      {
        name: "Mansur Shah",
        from: 1459,
        to: 1477
      },
      {
        name: "Mahmud Shah",
        from: 1488,
        to: 1511
      }
    ],
    zones: [
      {
        lon: 102.25,
        lat: 2.2,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Malacca_Sultanate",
      "https://openstax.org/books/world-history-volume-2/pages/2-2-the-malacca-sultanate"
    ],
    dateNote: {
      en: "Founding around 1400 and capture 1511 per OpenStax. The en.wiki infobox lists rulers and reigns, but some ranges conflict with the OpenStax text. Johor continued the line after 1528. Coordinates from en.wiki (Melaka).",
      id: "Pendirian sekitar 1400 dan penaklukan 1511 menurut OpenStax. Infobox en.wiki mencantumkan raja dan masa pemerintahan, tetapi beberapa rentang tidak sesuai dengan teks OpenStax. Johor melanjutkan garis keturunan setelah 1528. Koordinat dari en.wiki (Melaka)."
    }
  },
  {
    id: "pedir",
    name: "Kerajaan Pedir",
    from: 1400,
    to: 1524,
    category: "islamic",
    region: "sumatra",
    place: "Pedir (Pidie), Sigli, Aceh",
    placeId: "Pedir (Pidie), Sigli, Aceh",
    summary: {
      en: "A coastal kingdom in Pidie, Aceh, recorded from around 1400 to 1524 before it became a vassal of Aceh.",
      id: "Kerajaan pesisir di Pidie, Aceh, tercatat sekitar 1400 hingga 1524 sebelum menjadi bawahan Aceh."
    },
    rulers: [],
    zones: [
      {
        lon: 95.95944,
        lat: 5.38444,
        radiusKm: 40,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Pedir"
    ],
    dateNote: {
      en: "Id.wiki infobox gives 1400-1524, with 1524 as the vassal date. The ruler list has no reign years. Zone uses Sigli (Pidie seat) from en.wiki. No second source opened.",
      id: "Infobox id.wiki memberi 1400-1524, dengan 1524 sebagai tanggal menjadi bawahan. Daftar raja tanpa tahun pemerintahan. Zona memakai Sigli dari en.wiki. Tidak ada sumber kedua yang dibuka."
    }
  },
  {
    id: "wajo",
    name: "Kerajaan Wajo",
    from: 1400,
    to: 1944,
    category: "regional",
    region: "sulawesi",
    place: "Tosora, Majauleng, Wajo, South Sulawesi",
    placeId: "Tosora, Majauleng, Wajo, Sulawesi Selatan",
    summary: {
      en: "A Bugis federation of representative chiefs, with its capital at Tosora from about 1610 to 1885, and Islam from 1610.",
      id: "Federasi Bugis dengan kepala-kepala representatif, ibu kota di Tosora sekitar 1610–1885, dan memeluk Islam sejak 1610."
    },
    rulers: [],
    zones: [
      {
        lon: 120.13001,
        lat: -4.11805,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Wajo",
      "https://id.wikipedia.org/wiki/Tosora,_Majauleng,_Wajo"
    ],
    dateNote: {
      en: "'Sekitar 1400' per infobox (earliest year = 1400, rounded from 'sekitar'). End: dissolved and made a regency in 1957, capped to 1944. Centre = Tosora village (capital 1610–1885); the source gives Cinnotabi' before 1610 and Sengkang after 1885.",
      id: "'Sekitar 1400' per infobox (earliest year = 1400, rounded from 'sekitar'). End: dissolved and made a regency in 1957, capped to 1944. Centre = Tosora village (capital 1610–1885); the source gives Cinnotabi' before 1610 and Sengkang after 1885."
    }
  },
  {
    id: "waigeo",
    name: "Kerajaan Waigeo",
    from: 1401,
    to: 1918,
    category: "regional",
    region: "papua",
    place: "Wawiyai, Waigeo Selatan, Raja Ampat",
    placeId: "Wawiyai, Waigeo Selatan, Raja Ampat",
    summary: {
      en: "A traditional Raja Ampat realm on Waigeo island, centred at Wawiyai and part of the Kolano Fat alliance. Dutch authorities removed its official structure in 1918.",
      id: "Kerajaan tradisional di Pulau Waigeo, berpusat di Wawiyai, bagian dari persekutuan Kolano Fat (Raja Ampat). Struktur resminya dihapus Hindia Belanda pada 1918."
    },
    rulers: [],
    zones: [
      {
        lon: 130.6653,
        lat: -0.2998,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Waigeo",
      "https://id.wikipedia.org/wiki/Wawiyai,_Waigeo_Selatan,_Raja_Ampat"
    ],
    dateNote: {
      en: "Source gives 'abad ke-15 (perkiraan)' (approximate 15th century). Per relaxed rule, from = 1401, the earliest year of that century. End 1918 per source infobox. Centre coordinates are Wawiyai village, the stated capital.",
      id: "Source gives 'abad ke-15 (perkiraan)' (approximate 15th century). Per relaxed rule, from = 1401, the earliest year of that century. End 1918 per source infobox. Centre coordinates are Wawiyai village, the stated capital."
    }
  },
  {
    id: "negara-daha",
    name: "Kerajaan Negara Daha",
    from: 1478,
    to: 1526,
    category: "hindu-buddhist",
    region: "borneo",
    place: "Nagara / Daha Selatan, Hulu Sungai Selatan",
    placeId: "Nagara, Daha Selatan, Hulu Sungai Selatan",
    summary: {
      en: "A Hindu-Buddhist kingdom in South Kalimantan with its seat at Nagara in Daha Selatan, which was succeeded by the Banjar sultanate in 1526.",
      id: "Kerajaan Hindu-Buddha di Kalimantan Selatan dengan pusat di Nagara, Daha Selatan, yang digantikan Kesultanan Banjar pada 1526."
    },
    rulers: [
      {
        name: "Sari Kaburangan",
        to: 1486
      },
      {
        name: "Pangeran Tumenggung",
        to: 1526
      }
    ],
    zones: [
      {
        lon: 115.10689087,
        lat: -2.63764504,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Negara_Daha",
      "https://id.wikipedia.org/wiki/Daha_Selatan,_Hulu_Sungai_Selatan"
    ],
    dateNote: {
      en: "Founded and dissolved 1478 and 1526 per infobox. Centre = Daha Selatan kecamatan, the modern seat of the Nagara capital.",
      id: "Founded and dissolved 1478 and 1526 per infobox. Centre = Daha Selatan kecamatan, the modern seat of the Nagara capital."
    }
  },
  {
    id: "giri",
    name: "Kesultanan Giri",
    from: 1487,
    to: 1680,
    category: "islamic",
    region: "java",
    place: "Giri Kedaton, Gresik, East Java",
    placeId: "Giri Kedaton, Gresik, Jawa Timur",
    summary: {
      en: "A religious and political centre founded by Sunan Giri at Gresik, dating from 1487 to 1680. Its end was by conquest.",
      id: "Pusat keagamaan dan politik yang didirikan Sunan Giri di Gresik, tercatat sejak 1487 hingga 1680. Akhirnya ditaklukkan."
    },
    rulers: [
      {
        name: "Sunan Giri I (Raden Paku)",
        from: 1487,
        to: 1506
      },
      {
        name: "Sunan Dalem",
        from: 1506,
        to: 1546
      },
      {
        name: "Sunan Prapen",
        from: 1548,
        to: 1605
      },
      {
        name: "Panembahan Ageng Giri",
        from: 1616,
        to: 1636
      }
    ],
    zones: [
      {
        lon: 112.65611,
        lat: -7.15389,
        radiusKm: 30,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Giri_Kedaton",
      "https://disparekrafbudpora.gresikkab.go.id/detailpost/situs-giri-kedaton"
    ],
    dateNote: {
      en: "Id.wiki gives 1487-1680 and the official Gresik site gives about 1487. Some sources give 1481 or 1478 for the pesantren. Zone uses Gresik regency centroid; Giri Kedaton has no coordinates on en.wiki.",
      id: "id.wiki memberi 1487-1680 dan situs resmi Gresik memberi sekitar 1487. Beberapa sumber memberi 1481 atau 1478 untuk pesantren. Zona memakai pusat Kabupaten Gresik; Giri Kedaton tidak punya koordinat di en.wiki."
    }
  },
  {
    id: "salawati",
    name: "Kerajaan Salawati",
    from: 1501,
    to: 1935,
    category: "islamic",
    region: "papua",
    place: "Samate, North Salawati, Raja Ampat",
    placeId: "Samate, Salawati Utara, Raja Ampat",
    summary: {
      en: "A Raja Ampat Islamic kingdom centred at Samate on Salawati island, under Tidore suzerainty. It is documented in 18th-century sources and ruled into the early 20th century.",
      id: "Kerajaan Islam di Raja Ampat yang berpusat di Samate, Pulau Salawati, di bawah pengaruh Tidore. Tercatat sejak abad ke-18 dan memerintah hingga awal abad ke-20."
    },
    rulers: [
      {
        name: "Abdul Al-Kasim",
        from: 1873,
        to: 1890
      },
      {
        name: "Muhammad Aminuddin Arfan",
        from: 1900,
        to: 1918
      },
      {
        name: "Bahar Ad-Din Arfan",
        from: 1918,
        to: 1935
      }
    ],
    zones: [
      {
        lon: 131.07256,
        lat: -0.97321,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Salawati",
      "https://id.wikipedia.org/wiki/Samate,_Salawati_Utara,_Raja_Ampat"
    ],
    dateNote: {
      en: "Source gives 16th century for the Islamic ruler Bayajid (4th ruler), so from = 1501, the earliest year of that century; the founder's date is not given. Later 18th-century references are not used as start. End 1935 is the last ruler's reign end in the source.",
      id: "Source gives 16th century for the Islamic ruler Bayajid (4th ruler), so from = 1501, the earliest year of that century; the founder's date is not given. Later 18th-century references are not used as start. End 1935 is the last ruler's reign end in the source."
    }
  },
  {
    id: "banggai",
    name: "Kesultanan Banggai",
    from: 1501,
    to: 1908,
    category: "islamic",
    region: "sulawesi",
    place: "Banggai Islands (Pulau Banggai), Central Sulawesi",
    placeId: "Pulau Banggai, Kepulauan Banggai, Sulawesi Tengah",
    summary: {
      en: "An Islamic sultanate on Banggai island, said to have been formed under Ternate in the early 16th century and declared a Dutch Landschap in 1908.",
      id: "Kesultanan Islam di Pulau Banggai, menurut sumber berdiri di bawah pengaruh Ternate pada awal abad ke-16, dan dinyatakan sebagai landschap Belanda pada 1908."
    },
    rulers: [],
    zones: [
      {
        lon: 123.567,
        lat: -1.617,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Banggai",
      "https://id.wikipedia.org/wiki/Pulau_Banggai"
    ],
    dateNote: {
      en: "'Awal abad ke-16' start, earliest year 1501 (relaxed rule). The source calls the Dutch Landschap of 1908 the new order; 1908 is the latest year given, so 'to' is set there. Centre = Banggai island (source: centred on the island).",
      id: "'Awal abad ke-16' start, earliest year 1501 (relaxed rule). The source calls the Dutch Landschap of 1908 the new order; 1908 is the latest year given, so 'to' is set there. Centre = Banggai island (source: centred on the island)."
    }
  },
  {
    id: "balanipa",
    name: "Kerajaan Balanipa (Mandar)",
    from: 1511,
    to: 1944,
    category: "islamic",
    region: "sulawesi",
    place: "Balanipa, Polewali Mandar, West Sulawesi",
    placeId: "Balanipa, Polewali Mandar, Sulawesi Barat",
    summary: {
      en: "The Mandar kingdom of Balanipa, founded in 1511 by I Manyambungi, which adopted Islam as state religion under its fourth ruler.",
      id: "Kerajaan Mandar Balanipa, didirikan 1511 oleh I Manyambungi, yang menjadikan Islam agama resmi pada masa rajanya yang keempat."
    },
    rulers: [],
    zones: [
      {
        lon: 119.0576298,
        lat: -3.4782973,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Balanipa",
      "https://id.wikipedia.org/wiki/Balanipa,_Polewali_Mandar"
    ],
    dateNote: {
      en: "1511 founding per source. No end date in the excerpt, so 'to' is set to the 1944 cap. Centre = Balanipa kecamatan (named seat).",
      id: "1511 founding per source. No end date in the excerpt, so 'to' is set to the 1944 cap. Centre = Balanipa kecamatan (named seat)."
    }
  },
  {
    id: "portuguese-maluku",
    name: "Maluku Portugis",
    from: 1512,
    to: 1575,
    category: "colonial",
    region: "maluku",
    place: "Ternate, North Maluku (Fort São João Baptista / Kastela)",
    placeId: "Ternate, Maluku Utara (Benteng São João Baptista / Kastela)",
    summary: {
      en: "Portuguese trading and fortress presence in the northern Moluccas, centred on the São João Baptista fort on Ternate. It began with arrivals from 1512, and the Portuguese left Ternate in July 1575.",
      id: "Kehadiran dagang dan benteng Portugis di Maluku Utara, berpusat di Benteng São João Baptista di Ternate. Dimulai dengan kedatangan 1512 dan berakhir ketika Portugis meninggalkan Ternate pada Juli 1575."
    },
    rulers: [],
    zones: [
      {
        lon: 127.38194,
        lat: 0.78,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Ternatean%E2%80%93Portuguese_conflicts",
      "https://en.wikipedia.org/wiki/Fort_Kastela"
    ],
    dateNote: {
      en: "1512 is the year Portuguese appear in Moluccan waters. The fort was built around 1522. Exit on 15 July 1575 is from the source. Zone coordinates are Ternate city-level, not the fort's exact position. This record covers Ternate only; Portuguese posts at Ambon continued after 1575.",
      id: "1512 is the year Portuguese appear in Moluccan waters. The fort was built around 1522. Exit on 15 July 1575 is from the source. Zone coordinates are Ternate city-level, not the fort's exact position. This record covers Ternate only; Portuguese posts at Ambon continued after 1575."
    }
  },
  {
    id: "banda-neira",
    name: "Banda (para Orang Kaya)",
    from: 1512,
    to: 1621,
    category: "regional",
    region: "maluku",
    place: "Banda Neira, Banda Islands",
    placeId: "Banda Neira, Kepulauan Banda",
    summary: {
      en: "Local Orang Kaya magnates ruled the Banda Islands before the Dutch conquest. The Portuguese first called in 1512, and the Dutch conquest culminated in the 1621 massacre.",
      id: "Para pembesar Orang Kaya memerintah Kepulauan Banda sebelum penaklukan Belanda. Portugis pertama kali singgah pada 1512, dan penaklukan Belanda memuncak pada pembantaian 1621."
    },
    rulers: [],
    zones: [
      {
        lon: 129.9025,
        lat: -4.5175,
        radiusKm: 20,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Banda_Islands",
      "https://en.wikipedia.org/wiki/Banda_Neira"
    ],
    dateNote: {
      en: "1512 is the earliest sourced year (first Portuguese arrival), not the start of the Orang Kaya polity, which the source does not date. 1621 is the Dutch conquest and massacre year, as the source gives. Coordinates are Banda Neira, the town and island seat.",
      id: "1512 is the earliest sourced year (first Portuguese arrival), not the start of the Orang Kaya polity, which the source does not date. 1621 is the Dutch conquest and massacre year, as the source gives. Coordinates are Banda Neira, the town and island seat."
    }
  },
  {
    id: "larantuka",
    name: "Kerajaan Larantuka",
    from: 1515,
    to: 1944,
    category: "regional",
    region: "nusa-tenggara",
    place: "Larantuka, East Flores",
    placeId: "Larantuka, Flores Timur",
    summary: {
      en: "A Catholic principality on eastern Flores that began as a Portuguese tributary and later became a Dutch-supervised self-ruling territory, seated at Larantuka.",
      id: "Kerajaan Katolik di Flores Timur yang awalnya menjadi negeri bawahan Portugis lalu menjadi wilayah zelfbestuur di bawah pengawasan Belanda, berpusat di Larantuka."
    },
    rulers: [],
    zones: [
      {
        lon: 122.984267,
        lat: -8.33881,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Kingdom_of_Larantuka",
      "https://id.wikipedia.org/wiki/Larantuka,_Flores_Timur"
    ],
    dateNote: {
      en: "1515 is the infobox start date. End is capped at 1944; the source gives 1962. No ruler list gives both start and end years, so no rulers are included.",
      id: "1515 is the infobox start date. End is capped at 1944; the source gives 1962. No ruler list gives both start and end years, so no rulers are included."
    }
  },
  {
    id: "portuguese-timor",
    name: "Timor Portugis",
    from: 1515,
    to: 1942,
    category: "colonial",
    region: "nusa-tenggara",
    place: "Dili, Timor (Portuguese Timor)",
    placeId: "Dili, Timor (Timor Portugis)",
    summary: {
      en: "The eastern half of Timor under Portuguese rule. First landing came in 1515, the capital moved from Lifau to Dili in 1769, and Japan occupied the territory from 1942.",
      id: "Separuh timur Pulau Timor di bawah kekuasaan Portugis. Pendaratan pertama 1515, ibu kota pindah dari Lifau ke Dili pada 1769, dan Jepang menduduki wilayah ini sejak 1942."
    },
    rulers: [],
    zones: [
      {
        lon: 125.57833,
        lat: -8.55361,
        radiusKm: 150,
        confidence: "attested-centre",
        from: 1769,
        to: 1942
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Portuguese_Timor",
      "https://en.wikipedia.org/wiki/Dili"
    ],
    dateNote: {
      en: "Source is en.wikipedia 'Portuguese Timor' (replaces the tourism site). It gives first Portuguese landing 1515 (marked citation needed), Lifau capital 1702-1769, Dili 1769-1942 and Japanese occupation 1942-45; Portugal kept nominal sovereignty until 1975. 'To' is set at 1942 for the occupation.",
      id: "Source is en.wikipedia 'Portuguese Timor' (replaces the tourism site). It gives first Portuguese landing 1515 (marked citation needed), Lifau capital 1702-1769, Dili 1769-1942 and Japanese occupation 1942-45; Portugal kept nominal sovereignty until 1975. 'To' is set at 1942 for the occupation."
    }
  },
  {
    id: "paser-sadurangas",
    name: "Kesultanan Paser",
    from: 1516,
    to: 1944,
    category: "regional",
    region: "borneo",
    place: "Tanah Grogot, Paser, East Kalimantan",
    placeId: "Tanah Grogot, Paser, Kalimantan Timur",
    summary: {
      en: "A Paser polity, first named Sadurangas and later a sultanate, founded around 1516 under a queen and later under the Banjar sphere.",
      id: "Kerajaan Paser, semula bernama Sadurangas dan kemudian kesultanan, berdiri sekitar 1516 di bawah pemerintahan seorang ratu dan kemudian berada dalam lingkup pengaruh Banjar."
    },
    rulers: [],
    zones: [
      {
        lon: 116.2,
        lat: -1.92,
        radiusKm: 60,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Pasir",
      "https://id.wikipedia.org/wiki/Tanah_Grogot,_Paser"
    ],
    dateNote: {
      en: "Founding 'sekitar tahun 1516' per source. The source excerpt gives no end date, so 'to' is set to the 1944 cap. Centre = Tanah Grogot (regency seat, modern), not a verified palace site. Entry covers the 'Pasir' name variant.",
      id: "Founding 'sekitar tahun 1516' per source. The source excerpt gives no end date, so 'to' is set to the 1944 cap. Centre = Tanah Grogot (regency seat, modern), not a verified palace site. Entry covers the 'Pasir' name variant."
    }
  },
  {
    id: "wehali",
    name: "Kerajaan Wehali (Malaka)",
    from: 1522,
    to: 1944,
    category: "regional",
    region: "nusa-tenggara",
    place: "Wehali village (Laran), Malaka Tengah, south Timor",
    placeId: "Desa Wehali (Laran), Malaka Tengah, Malaka",
    summary: {
      en: "A traditional kingdom on Timor's south coast, ritually senior to many Timorese realms and later merged with Wewiku as Malaka. Its ritual centre is at Laran, now Wehali village.",
      id: "Kerajaan tradisional di pantai selatan Timor, berposisi senior secara ritual di antara banyak kerajaan Timor, dan kemudian bersatu dengan Wewiku sebagai Malaka. Pusat ritualnya di Laran, kini Desa Wehali."
    },
    rulers: [],
    zones: [
      {
        lon: 124.8975,
        lat: -9.5719,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Wehali",
      "https://id.wikipedia.org/wiki/Kerajaan_Wehali",
      "https://id.wikipedia.org/wiki/Wehali,_Malaka_Tengah,_Malaka"
    ],
    dateNote: {
      en: "1522 is the earliest sourced year (Pigafetta's visit, en Wikipedia); no founding date is given. End set to 1944 cap; the source's latest year is 1949 (traditional forms phased out after independence). Single-year ruler 1766 omitted (no reign range).",
      id: "1522 is the earliest sourced year (Pigafetta's visit, en Wikipedia); no founding date is given. End set to 1944 cap; the source's latest year is 1949 (traditional forms phased out after independence). Single-year ruler 1766 omitted (no reign range)."
    }
  },
  {
    id: "johor-sultanate",
    name: "Kesultanan Johor",
    from: 1528,
    to: 1855,
    category: "islamic",
    region: "malay-peninsula",
    place: "Johor Bahru, Johor (historic seats: Johor Lama, Riau)",
    placeId: "Johor Bahru, Johor (pusat sejarah: Johor Lama, Riau)",
    summary: {
      en: "The Johor sultanate, founded in 1528 as a successor to Malacca. Its formal end is often given as 1855, but the royal line continued in Johor after that.",
      id: "Kesultanan Johor, didirikan 1528 sebagai penerus Melaka. Akhir resminya sering disebut 1855, tetapi garis keturunan raja berlanjut di Johor setelah itu."
    },
    rulers: [
      {
        name: "Sultan Alauddin Riayat Shah II",
        from: 1528,
        to: 1564
      },
      {
        name: "Sultan Ali Iskandar",
        from: 1835,
        to: 1855
      }
    ],
    zones: [
      {
        lon: 103.76111,
        lat: 1.45556,
        radiusKm: 60,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Johor"
    ],
    dateNote: {
      en: "Id.wiki gives 1528 founding and 1855 dissolution. The 1855 end conflicts with the continued Johor line, so 1855 is the infobox date only. Seats moved (Sayong Pinang, Batu Sawar, Lingga, Singapura). Zone uses Johor Bahru from en.wiki; historic seats are not coordinated. Only one source opened; royal.johor.my failed.",
      id: "id.wiki memberi pendirian 1528 dan pembubaran 1855. Akhir 1855 bertentangan dengan garis Johor yang berlanjut, sehingga 1855 hanya tanggal infobox. Pusat berpindah (Sayong Pinang, Batu Sawar, Lingga, Singapura). Zona memakai Johor Bahru dari en.wiki; pusat bersejarah tidak punya koordinat. Hanya satu sumber yang dibuka; royal.johor.my gagal."
    }
  },
  {
    id: "kesultanan-langkat",
    name: "Kesultanan Langkat",
    from: 1568,
    to: 1944,
    category: "islamic",
    region: "sumatra",
    place: "Tanjung Pura, Langkat Regency, North Sumatra",
    placeId: "Tanjung Pura, Kabupaten Langkat, Sumatera Utara",
    summary: {
      en: "A Malay sultanate in North Sumatra, traced to a 1568 founding by Dewa Syahdan. Its start date is disputed.",
      id: "Kesultanan Melayu di Sumatra Utara, ditelusuri ke pendirian 1568 oleh Dewa Syahdan. Tanggal awalnya diperdebatkan."
    },
    rulers: [
      {
        name: "Sultan Abdul Aziz",
        from: 1897,
        to: 1927
      }
    ],
    zones: [
      {
        lon: 98.217,
        lat: 3.767,
        radiusKm: 50,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Langkat",
      "https://digilib.uin-suka.ac.id/id/eprint/21151/"
    ],
    dateNote: {
      en: "1568 and a UIN Sunan Kalijaga thesis. Other sources name Raja Kahar as founder and treat 1568 as a predecessor. Zone uses the Langkat regency centroid; Tanjung Pura is the infobox seat but has no coordinates on en.wiki.",
      id: "1568 dan skripsi UIN Sunan Kalijaga. Sumber lain menyebut Raja Kahar sebagai pendiri dan menganggap 1568 sebagai kerajaan pendahulu. Zona memakai pusat kabupaten Langkat; Tanjung Pura adalah ibu kota dalam infobox tetapi tidak punya koordinat di en.wiki."
    }
  },
  {
    id: "spanish-maluku",
    name: "Maluku Spanyol",
    from: 1580,
    to: 1663,
    category: "colonial",
    region: "maluku",
    place: "Tidore, Maluku (with Ternate)",
    placeId: "Tidore, Maluku (dan Ternate)",
    summary: {
      en: "Spanish forts and garrisons in the northern Moluccas, chiefly on Tidore and at Ternate, abandoned in 1663 under Dutch and Ternatean pressure.",
      id: "Benteng dan garnisun Spanyol di Maluku Utara, terutama di Tidore dan Ternate, yang ditinggalkan pada 1663 karena tekanan Belanda dan Ternate."
    },
    rulers: [],
    zones: [
      {
        lon: 127.4,
        lat: 0.683,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Spanish_East_Indies",
      "https://en.wikipedia.org/wiki/Fort_Kastela",
      "https://en.wikipedia.org/wiki/Tidore"
    ],
    dateNote: {
      en: "The source's territorial list gives Moluccan presence as 1580–1663. Spanish trade links with the Moluccas started in 1606, per the same page. Evacuation is dated 2 May 1663 in source. Tidore coordinates are for the island.",
      id: "The source's territorial list gives Moluccan presence as 1580–1663. Spanish trade links with the Moluccas started in 1606, per the same page. Evacuation is dated 2 May 1663 in source. Tidore coordinates are for the island."
    }
  },
  {
    id: "sikka",
    name: "Kerajaan Sikka",
    from: 1607,
    to: 1944,
    category: "regional",
    region: "nusa-tenggara",
    place: "Sikka Natar (Sikka village), south coast of Flores",
    placeId: "Sikka Natar (Desa Sikka), pesisir selatan Flores",
    summary: {
      en: "A Catholic-era Flores kingdom seated at Sikka Natar on the south coast. Local tradition dates its first Catholic raja to 1607, and Portuguese influence passed to the Dutch in 1859.",
      id: "Kerajaan Katolik di Flores yang berpusat di Sikka Natar, pesisir selatan. Tradisi lokal menyebut raja Katolik pertama sejak 1607, dan pengaruh Portugis beralih ke Belanda pada 1859."
    },
    rulers: [],
    zones: [
      {
        lon: 122.2089,
        lat: -8.735,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Kingdom_of_Sikka",
      "https://id.wikipedia.org/wiki/Sikka,_Lela,_Sikka",
      "https://id.wikipedia.org/wiki/Kerajaan_Sikka"
    ],
    dateNote: {
      en: "1607 is a local-tradition date given by the source. End: en source gives 1958, capped to 1944. Coordinates are for Desa Sikka (Lela), which the en source identifies as Sikka Natar village. Maumere took over as seat in the 20th century; that is outside the range.",
      id: "1607 is a local-tradition date given by the source. End: en source gives 1958, capped to 1944. Coordinates are for Desa Sikka (Lela), which the en source identifies as Sikka Natar village. Maumere took over as seat in the 20th century; that is outside the range."
    }
  },
  {
    id: "karangasem",
    name: "Kerajaan Karangasem",
    from: 1611,
    to: 1894,
    category: "hindu-buddhist",
    region: "bali",
    place: "Amlapura (Karangasem), East Bali",
    placeId: "Amlapura (Karangasem), Bali Timur",
    summary: {
      en: "A Balinese kingdom founded under the Arya Batan Jeruk dynasty in 1611 and conquered by the Dutch in 1894.",
      id: "Kerajaan Bali yang didirikan di bawah dinasti Arya Batan Jeruk pada 1611 dan ditaklukkan Belanda pada 1894."
    },
    rulers: [
      {
        name: "I Gusti Nyoman Karang",
        from: 1611,
        to: 1650
      },
      {
        name: "I Gusti Anglurah Ketut Karang",
        from: 1650,
        to: 1680
      },
      {
        name: "I Gusti Anglurah Wayan Karangasem",
        from: 1680,
        to: 1705
      }
    ],
    zones: [
      {
        lon: 115.615,
        lat: -8.447,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Karangasem",
      "https://v2.karangasemkab.go.id/index.php/profil/17/Sejarah/"
    ],
    dateNote: {
      en: "Conflict: the official Karangasem site gives 22 June 1611 as the founding, and id.wiki infobox gives 1661 (range 1661-1894). The record uses 1611. Id.wiki and the official site give different ruler years (the official site: Nyoman Karang 1611-1650). The 1894 end is from id.wiki only.",
      id: "Konflik: situs resmi Karangasem memberi 22 Juni 1611 sebagai pendirian, sedangkan infobox id.wiki memberi 1661 (rentang 1661-1894). Rekaman ini memakai 1611. id.wiki dan situs resmi berbeda untuk tahun raja. Akhir 1894 hanya dari id.wiki."
    }
  },
  {
    id: "kotawaringin",
    name: "Kesultanan Kotawaringin",
    from: 1615,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Kotawaringin Lama, Kotawaringin Barat, Central Kalimantan",
    placeId: "Kotawaringin Lama, Kotawaringin Barat, Kalimantan Tengah",
    summary: {
      en: "A Malay-Dayak sultanate on the Central Kalimantan coast, founded in 1615 as a Banjar vassal, with its first capital at Kotawaringin Lama and later Pangkalan Bun.",
      id: "Kesultanan Melayu-Dayak di pesisir Kalimantan Tengah, didirikan 1615 sebagai vasal Banjar, ibu kota pertama di Kotawaringin Lama dan kemudian Pangkalan Bun."
    },
    rulers: [],
    zones: [
      {
        lon: 111.41150456,
        lat: -2.44868713,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Kotawaringin",
      "https://id.wikipedia.org/wiki/Kotawaringin_Lama,_Kotawaringin_Barat"
    ],
    dateNote: {
      en: "1615–1948 per infobox; end capped to 1944. Vassal status to Banjar is listed for 1615–1787 and 1797–1825. Centre = Kotawaringin Lama kecamatan (first capital).",
      id: "1615–1948 per infobox; end capped to 1944. Vassal status to Banjar is listed for 1615–1787 and 1797–1825. Centre = Kotawaringin Lama kecamatan (first capital)."
    }
  },
  {
    id: "ende",
    name: "Kerajaan Ende",
    from: 1630,
    to: 1793,
    category: "islamic",
    region: "nusa-tenggara",
    place: "Ende, central Flores",
    placeId: "Ende, Flores Tengah",
    summary: {
      en: "A Flores kingdom centred in Ende, traditionally founded by a Javanese leader who helped drive the Portuguese from Ende island around 1630. Its early history is mainly known from colonial records and local tradition.",
      id: "Kerajaan di Ende, Flores, yang menurut tradisi didirikan oleh pemimpin asal Jawa yang membantu mengusir Portugis dari Pulau Ende sekitar 1630. Sejarah awalnya terutama diketahui dari catatan kolonial dan tradisi lokal."
    },
    rulers: [],
    zones: [
      {
        lon: 121.6211,
        lat: -8.7606,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://khazanah.republika.co.id/berita/p6c2c2313/eksistensi-kerajaan-islam-ende",
      "https://id.wikipedia.org/wiki/Ende,_Ende"
    ],
    dateNote: {
      en: "1630 is the source's date for the expulsion of the Portuguese (tradition-based start). 1793 is the latest year in the opened source (VOC Korte Verklaring); not an end date. The Ambu Tonda centre is not located; coordinates are for Ende kecamatan (modern seat), per the relaxed rule.",
      id: "1630 is the source's date for the expulsion of the Portuguese (tradition-based start). 1793 is the latest year in the opened source (VOC Korte Verklaring); not an end date. The Ambu Tonda centre is not located; coordinates are for Ende kecamatan (modern seat), per the relaxed rule."
    }
  },
  {
    id: "kesultanan-deli",
    name: "Kesultanan Deli",
    from: 1632,
    to: 1944,
    category: "islamic",
    region: "sumatra",
    place: "Medan, North Sumatra",
    placeId: "Medan, Sumatera Utara",
    summary: {
      en: "A Malay sultanate on Sumatra's east coast, founded by Tuanku Panglima Gocah Pahlawan and initially under Aceh's influence.",
      id: "Kesultanan Melayu di pantai timur Sumatra, didirikan Tuanku Panglima Gocah Pahlawan dan awalnya di bawah pengaruh Aceh."
    },
    rulers: [
      {
        name: "Tuanku Panglima Gocah Pahlawan",
        from: 1632,
        to: 1669
      },
      {
        name: "Tuanku Panglima Perunggit",
        from: 1669,
        to: 1698
      },
      {
        name: "Tuanku Panglima Padrap",
        from: 1698,
        to: 1728
      },
      {
        name: "Tuanku Panglima Pasutan",
        from: 1728,
        to: 1761
      },
      {
        name: "Tuanku Panglima Gandar Wahid",
        from: 1761,
        to: 1805
      },
      {
        name: "Tuanku Amaludin Mangendar Alam Pura",
        from: 1805,
        to: 1850
      }
    ],
    zones: [
      {
        lon: 98.67389,
        lat: 3.58944,
        radiusKm: 60,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Deli",
      "https://www.detik.com/sumut/budaya/d-7408035/kesultanan-deli-sejarah-raja-raja-peninggalan-dan-masa-kejayaannya"
    ],
    dateNote: {
      en: "Founding 1632 and Detik. The Serdang government page gives 1630. The end is capped at 1944; the sultanate continued after. Medan is a documented capital in the id.wiki infobox (Medan coordinates from en.wiki). No official second source opened.",
      id: "Pendirian 1632 dan Detik. Halaman pemerintah Serdang menyebut 1630. Akhir dibatasi 1944; kesultanan berlanjut setelahnya. Medan tercantum sebagai ibu kota dalam infobox id.wiki (koordinat dari en.wiki). Belum ada sumber resmi kedua yang dibuka."
    }
  },
  {
    id: "selaparang",
    name: "Kerajaan Selaparang",
    from: 1645,
    to: 1692,
    category: "islamic",
    region: "nusa-tenggara",
    place: "Selaparang, East Lombok, Lombok Island",
    placeId: "Selaparang, Lombok Timur, Pulau Lombok",
    summary: {
      en: "A Sasak kingdom centred at Selaparang on eastern Lombok, first securely dated in VOC records of 1645. Its Hindu and 15th-century Islamic origins are uncertain, and it was overrun by Mataram and Karangasem forces around 1692.",
      id: "Kerajaan Sasak di Selaparang, Lombok Timur, yang tercatat dalam catatan VOC 1645 dan diperkirakan ditaklukkan pasukan Mataram dan Karangasem sekitar 1692. Asal-usul Hindu dan Islam abad ke-15 belum pasti."
    },
    rulers: [],
    zones: [
      {
        lon: 116.60102,
        lat: -8.54787,
        radiusKm: 40,
        confidence: "attested-centre",
        from: 1645,
        to: 1692
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Selaparang",
      "https://id.wikipedia.org/wiki/Selaparang,_Suwela,_Lombok_Timur",
      "https://repositori.kemendikdasmen.go.id/27685/"
    ],
    dateNote: {
      en: "1645 is the earliest securely dated record, not a founding date. Islamic origin claims range to the 15th century, and the 1648 installation is called anachronistic in the source. 1692 is given as 'sekitar tahun 1692' (around 1692).",
      id: "1645 is the earliest securely dated record, not a founding date. Islamic origin claims range to the 15th century, and the 1648 installation is called anachronistic in the source. 1692 is given as 'sekitar tahun 1692' (around 1692)."
    }
  },
  {
    id: "sonbai",
    name: "Kerajaan Sonbai",
    from: 1649,
    to: 1944,
    category: "regional",
    region: "nusa-tenggara",
    place: "Soe, West Timor (Amanuban highlands)",
    placeId: "Soe, Timor Barat (dataran tinggi Amanuban)",
    summary: {
      en: "A princely dynasty ruling Atoni highland domains of West Timor, documented from 1649 and shifting between Portuguese and VOC alliances. After defeats in 1657-58 part of the realm moved to Kupang.",
      id: "Dinasti kepangeranan yang memerintah wilayah dataran tinggi Atoni di Timor Barat, tercatat sejak 1649 dan berpindah-pindah antara aliansi Portugis dan VOC. Setelah kekalahan 1657-58, sebagian wilayah pindah ke Kupang."
    },
    rulers: [],
    zones: [
      {
        lon: 124.272575,
        lat: -9.866655,
        radiusKm: 60,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Sonbai",
      "https://en.wikipedia.org/wiki/Sonbai",
      "https://id.wikipedia.org/wiki/Kota_Soe,_Timor_Tengah_Selatan"
    ],
    dateNote: {
      en: "1649 is the first European-documented date (en/id Wikipedia), not a founding. End capped at 1944; sources say the dynasty lasted into the 1950s. Centre coordinates are the modern seat town Kota Soe (Wikipedia), not a verified palace site, so the attested-centre label is based on the seat-town rule.",
      id: "1649 is the first European-documented date (en/id Wikipedia), not a founding. End capped at 1944; sources say the dynasty lasted into the 1950s. Centre coordinates are the modern seat town Kota Soe (Wikipedia), not a verified palace site, so the attested-centre label is based on the seat-town rule."
    }
  },
  {
    id: "blambangan",
    name: "Kerajaan Blambangan",
    from: 1655,
    to: 1691,
    category: "hindu-buddhist",
    region: "java",
    place: "Banyuwangi, East Java (Macan Putih)",
    placeId: "Banyuwangi, Jawa Timur (Macan Putih)",
    summary: {
      en: "An east-Java kingdom whose capital at Macan Putih in Banyuwangi is attested under Susuhunan Tawang Alun.",
      id: "Kerajaan di ujung timur Jawa yang ibu kotanya di Macan Putih, Banyuwangi, tercatat pada masa Susuhunan Tawang Alun."
    },
    rulers: [
      {
        name: "Susuhunan Tawang Alun",
        from: 1655,
        to: 1691
      }
    ],
    zones: [
      {
        lon: 114.3669,
        lat: -8.2186,
        radiusKm: 60,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Blambangan",
      "https://prisma.simaster.ugm.ac.id/karya_files/menyusuri-jejak-macan-putih--bukti-bukti-historis-eksistensi-kerajaan-blambangan-pada-masa-susuhunan-tawang-alun-1655-1691-dcfcd07e645d245babe887e5e2daa016"
    ],
    dateNote: {
      en: "Id.wiki gives 1478-1768 (dejure) and 1777 (defacto). The record covers only Tawang Alun's attested reign (1655-1691). Its seat moved over time. Zone uses Banyuwangi town; Macan Putih has no coordinates in the sources.",
      id: "id.wiki memberi 1478-1768 (dejure) dan 1777 (defacto). Rekaman ini hanya mencakup masa Tawang Alun (1655-1691). Pusatnya berpindah-pindah. Zona memakai kota Banyuwangi; Macan Putih tidak punya koordinat dalam sumber."
    }
  },
  {
    id: "buleleng",
    name: "Kerajaan Buleleng",
    from: 1660,
    to: 1849,
    category: "hindu-buddhist",
    region: "bali",
    place: "Singaraja, North Bali",
    placeId: "Singaraja, Bali Utara",
    summary: {
      en: "A north-Bali kingdom founded in the mid-17th century by I Gusti Nglurah Panji Sakti. It fell to the Dutch in 1849.",
      id: "Kerajaan di Bali utara yang didirikan pertengahan abad ke-17 oleh I Gusti Nglurah Panji Sakti dan jatuh ke Belanda pada 1849."
    },
    rulers: [
      {
        name: "I Gusti Nglurah Panji Sakti",
        from: 1660,
        to: 1697
      }
    ],
    zones: [
      {
        lon: 115.083,
        lat: -8.117,
        radiusKm: 50,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Buleleng",
      "https://disbudpar.bulelengkab.go.id/informasi/detail/artikel/33-raja-buleleng"
    ],
    dateNote: {
      en: "Id.wiki infobox: founded 1660, dynasty span 1660-1848, article text 1849 for the Dutch takeover. The official disbudpar page says mid-17th century and 1849. Singaraja is the infobox capital; coordinates from en.wiki.",
      id: "Infobox id.wiki: didirikan 1660, rentang dinasti 1660-1848, teks artikel menyebut 1849 untuk penaklukan Belanda. Halaman resmi disbudpar menyebut pertengahan abad ke-17 dan 1849. Singaraja adalah ibu kota pada infobox; koordinat dari en.wiki."
    }
  },
  {
    id: "sumbawa-sultanate",
    name: "Kesultanan Sumbawa",
    from: 1674,
    to: 1944,
    category: "islamic",
    region: "nusa-tenggara",
    place: "Sumbawa Besar, Sumbawa Island",
    placeId: "Sumbawa Besar, Pulau Sumbawa",
    summary: {
      en: "An Islamic sultanate founded under the Dewa Dalam Bawa dynasty, holding about two-thirds of Sumbawa island and seated at Sumbawa Besar. It later joined the Indonesian state.",
      id: "Kesultanan Islam di Pulau Sumbawa yang didirikan dinasti Dewa Dalam Bawa, menguasai sekitar dua pertiga pulau dan berpusat di Sumbawa Besar. Kemudian bergabung dengan Indonesia."
    },
    rulers: [
      {
        name: "Harunnurrasyid I",
        from: 1674,
        to: 1702
      }
    ],
    zones: [
      {
        lon: 117.42731,
        lat: -8.50045,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Sumbawa",
      "https://id.wikipedia.org/wiki/Sumbawa,_Sumbawa"
    ],
    dateNote: {
      en: "Start is the dynasty founding year given in the source. End is capped at 1944; the source dates the merger into Indonesia to 1950. Zone uses the Sumbawa kecamatan (capital district) coordinates from id.wikipedia.",
      id: "Start is the dynasty founding year given in the source. End is capped at 1944; the source dates the merger into Indonesia to 1950. Zone uses the Sumbawa kecamatan (capital district) coordinates from id.wikipedia."
    }
  },
  {
    id: "bencoolen-british",
    name: "Bencoolen Inggris",
    from: 1685,
    to: 1825,
    category: "colonial",
    region: "sumatra",
    place: "Bengkulu city, Bengkulu Province, Sumatra",
    placeId: "Kota Bengkulu, Provinsi Bengkulu, Sumatra",
    summary: {
      en: "An English East India Company settlement on Sumatra's west coast from 1685, centred on Fort Marlborough. It was transferred to the Dutch in 1824-1825.",
      id: "Permukiman Perusahaan Hindia Timur Inggris di pantai barat Sumatra sejak 1685, berpusat di Fort Marlborough. Diserahkan kepada Belanda 1824-1825."
    },
    rulers: [],
    zones: [
      {
        lon: 102.25917,
        lat: -3.79556,
        radiusKm: 80,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Bengkulu",
      "https://www.cambridge.org/core/journals/journal-of-british-studies/article/making-and-unmaking-of-a-presidency-envisioning-empire-in-british-bencoolen-16851825/4C0CA8C6BF1E88181DA0CEACBC33C47A"
    ],
    dateNote: {
      en: "Cambridge gives 1685 founding and 1824 handover, completed 1825. The id.wiki Bengkulu page is a province article, not a polity article. Bengkulu city coordinates from en.wiki (Bengkulu city). Place corrected to Bengkulu Province.",
      id: "Cambridge memberi pendirian 1685 dan penyerahan 1824, selesai 1825. Halaman id.wiki Bengkulu adalah artikel provinsi, bukan artikel kesultanan. Koordinat kota Bengkulu dari en.wiki. Lokasi dikoreksi ke Provinsi Bengkulu."
    }
  },
  {
    id: "klungkung",
    name: "Kerajaan Klungkung",
    from: 1686,
    to: 1908,
    category: "hindu-buddhist",
    region: "bali",
    place: "Semarapura (Klungkung), Bali",
    placeId: "Semarapura (Klungkung), Bali",
    summary: {
      en: "A Balinese kingdom founded in 1686 by Dewa Agung Jambe as heir to Gelgel. Its last king died in the 1908 Puputan.",
      id: "Kerajaan Bali yang didirikan 1686 oleh Dewa Agung Jambe sebagai penerus Gelgel. Raja terakhirnya gugur dalam Puputan 1908."
    },
    rulers: [],
    zones: [
      {
        lon: 115.40361,
        lat: -8.53528,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Klungkung",
      "https://www.klungkungkab.go.id/halaman/detail/sejarah-klungkung"
    ],
    dateNote: {
      en: "Id.wiki infobox says 1668-present, but its text and the official Klungkung page give 1686. The 1908 end is the Puputan date from the official page; no formal abolition year is given. Reign years are not given for rulers. Semarapura coordinates from en.wiki.",
      id: "Infobox id.wiki menyebut 1668-sekarang, tetapi teksnya dan halaman resmi Klungkung menyebut 1686. Akhir 1908 adalah tanggal Puputan dari halaman resmi; tidak ada tahun penghapusan formal. Tahun pemerintahan raja tidak diberikan. Koordinat Semarapura dari en.wiki."
    }
  },
  {
    id: "kesultanan-serdang",
    name: "Kesultanan Serdang",
    from: 1723,
    to: 1944,
    category: "islamic",
    region: "sumatra",
    place: "Perbaungan, Serdang Bedagai Regency, North Sumatra",
    placeId: "Perbaungan, Kabupaten Serdang Bedagai, Sumatera Utara",
    summary: {
      en: "A sultanate that separated from Deli after a succession dispute in the 1720s. Its seat was in the Serdang area of East Sumatra.",
      id: "Kesultanan yang memisahkan diri dari Deli setelah sengketa takhta pada 1720-an. Pusatnya di kawasan Serdang, Sumatra Timur."
    },
    rulers: [
      {
        name: "Tuanku Sultan Ainan Johan Alam Shah",
        from: 1767,
        to: 1817
      },
      {
        name: "Tuanku Sultan Thaf Sinar Basar Shah",
        from: 1817,
        to: 1850
      }
    ],
    zones: [
      {
        lon: 99.0333,
        lat: 3.3667,
        radiusKm: 50,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Serdang",
      "https://mediacenter.serdangbedagaikab.go.id/2022/12/19/sejarah-singkat-kesultanan-serdang/"
    ],
    dateNote: {
      en: "Founding 1723 and the Serdang regency page; the regency page gives a 1720 split. Its ruler list is confusing (Tuanku Umar named first without years). Zone uses the Serdang Bedagai regency centroid; Perbaungan has no separate coordinates on en.wiki.",
      id: "Pendirian 1723 dan halaman Kabupaten Serdang; halaman itu menyebut pemisahan 1720. Daftar raja membingungkan (Tuanku Umar disebut pertama tanpa tahun). Zona memakai pusat kabupaten Serdang Bedagai; Perbaungan tidak punya koordinat terpisah di en.wiki."
    }
  },
  {
    id: "bulungan",
    name: "Kesultanan Bulungan",
    from: 1731,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Tanjung Palas, Bulungan, North Kalimantan",
    placeId: "Tanjung Palas, Bulungan, Kalimantan Utara",
    summary: {
      en: "A Muslim sultanate on the Bulungan river in north-east Kalimantan, founded in 1731 with its capital at Tanjung Palas.",
      id: "Kesultanan Islam di sungai Bulungan, Kalimantan timur laut, didirikan 1731 dengan ibu kota di Tanjung Palas."
    },
    rulers: [],
    zones: [
      {
        lon: 117.33781756,
        lat: 2.83635155,
        radiusKm: 40,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Bulungan",
      "https://id.wikipedia.org/wiki/Tanjung_Palas,_Bulungan"
    ],
    dateNote: {
      en: "Founded 1731 per infobox; the infobox's 1964 end (Bultiken) is capped to 1944. Centre = Tanjung Palas kecamatan, the infobox capital.",
      id: "Founded 1731 per infobox; the infobox's 1964 end (Bultiken) is capped to 1944. Centre = Tanjung Palas kecamatan, the infobox capital."
    }
  },
  {
    id: "mempawah",
    name: "Kerajaan Mempawah",
    from: 1740,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Mempawah, West Kalimantan",
    placeId: "Mempawah, Kalimantan Barat",
    summary: {
      en: "A Malay-Dayak panembahanate on the west Kalimantan coast with its seat at Mempawah, Islamised from about 1740.",
      id: "Panembahan Melayu-Dayak di pesisir barat Kalimantan dengan pusat di Mempawah, memeluk Islam sekitar 1740."
    },
    rulers: [
      {
        name: "Pangeran Mas Surya Negara",
        to: 1761
      },
      {
        name: "Gusti Muhammad Thaufiq Accamuddin",
        to: 1943
      }
    ],
    zones: [
      {
        lon: 108.9514055,
        lat: 0.36735934,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Mempawah",
      "https://id.wikipedia.org/wiki/Mempawah_Hilir,_Mempawah"
    ],
    dateNote: {
      en: "1740 is 'Berkembangnya Islam' per infobox, the earliest date given; the kingdom is dated 1740–1956 (capped to 1944). Centre = Mempawah Hilir kecamatan, the town seat.",
      id: "1740 is 'Berkembangnya Islam' per infobox, the earliest date given; the kingdom is dated 1740–1956 (capped to 1944). Centre = Mempawah Hilir kecamatan, the town seat."
    }
  },
  {
    id: "mangkunegaran",
    name: "Kadipaten Mangkunegaran",
    from: 1757,
    to: 1944,
    category: "regional",
    region: "java",
    place: "Pura Mangkunegaran, Surakarta, Central Java",
    placeId: "Pura Mangkunegaran, Surakarta, Jawa Tengah",
    summary: {
      en: "A principality formed by the 1757 Salatiga agreement under Raden Mas Said. It sat within the Surakarta area of Central Java.",
      id: "Praja yang terbentuk melalui Perjanjian Salatiga 1757 di bawah Raden Mas Said. Berpusat di kawasan Surakarta, Jawa Tengah."
    },
    rulers: [
      {
        name: "Mangkunegara I (Raden Mas Said)",
        from: 1757,
        to: 1795
      },
      {
        name: "Mangkunegara II",
        from: 1795,
        to: 1835
      },
      {
        name: "Mangkunegara III",
        from: 1835,
        to: 1853
      },
      {
        name: "Mangkunegara IV",
        from: 1853,
        to: 1881
      },
      {
        name: "Mangkunegara V",
        from: 1881,
        to: 1896
      },
      {
        name: "Mangkunegara VI",
        from: 1896,
        to: 1916
      }
    ],
    zones: [
      {
        lon: 110.82306,
        lat: -7.56639,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kadipaten_Mangkunegaran",
      "https://mangkunegaran.id/history/sejarah-singkat-mangkunegaran"
    ],
    dateNote: {
      en: "Founding 17 March 1757 per the official Mangkunegaran site. Id.wiki gives 1757-present. Ruler years are from id.wiki. Coordinates are for Pura Mangkunegaran from en.wiki.",
      id: "Pendirian 17 Maret 1757 menurut situs resmi Mangkunegaran. id.wiki memberi 1757-sekarang. Tahun pemerintahan raja dari id.wiki. Koordinat Pura Mangkunegaran dari en.wiki."
    }
  },
  {
    id: "pontianak",
    name: "Kesultanan Pontianak",
    from: 1771,
    to: 1944,
    category: "islamic",
    region: "borneo",
    place: "Pontianak, West Kalimantan",
    placeId: "Kota Pontianak, Kalimantan Barat",
    summary: {
      en: "A Malay Islamic sultanate founded in 1771 on the Kapuas delta, under Dutch suzerainty from 1779 and based at Pontianak.",
      id: "Kesultanan Melayu Islam yang didirikan 1771 di delta Kapuas, di bawah kedaulatan Belanda sejak 1779, berpusat di Pontianak."
    },
    rulers: [],
    zones: [
      {
        lon: 109.3414,
        lat: -0.0206,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Pontianak",
      "https://id.wikipedia.org/wiki/Kota_Pontianak"
    ],
    dateNote: {
      en: "1771 from infobox; 'Bagian dari Hindia Belanda (sejak 1779)' per infobox. Infobox end is 'Sekarang' (still exists); capped at 1944. Centre = Kota Pontianak (modern city).",
      id: "1771 from infobox; 'Bagian dari Hindia Belanda (sejak 1779)' per infobox. Infobox end is 'Sekarang' (still exists); capped at 1944. Centre = Kota Pontianak (modern city)."
    }
  },
  {
    id: "badung",
    name: "Kerajaan Badung",
    from: 1788,
    to: 1906,
    category: "hindu-buddhist",
    region: "bali",
    place: "Denpasar, Bali",
    placeId: "Denpasar, Bali",
    summary: {
      en: "A Balinese kingdom centred at Puri Agung Denpasar from 1788, defeated by the Dutch in the 1906 Puputan Badung.",
      id: "Kerajaan Bali yang berpusat di Puri Agung Denpasar sejak 1788, dikalahkan Belanda dalam Puputan Badung 1906."
    },
    rulers: [
      {
        name: "I Gusti Ngurah Made Pemecutan",
        from: 1788,
        to: 1813
      },
      {
        name: "I Gusti Ngurah Jambe Pemecutan",
        from: 1813,
        to: 1817
      },
      {
        name: "I Gusti Made Ngurah Pemecutan",
        from: 1817,
        to: 1829
      },
      {
        name: "I Gusti Gede Ngurah Pemecutan",
        from: 1829,
        to: 1848
      },
      {
        name: "I Gusti Alit Ngurah Pemecutan",
        from: 1848,
        to: 1902
      },
      {
        name: "I Gusti Ngurah Made Agung",
        from: 1902,
        to: 1906
      }
    ],
    zones: [
      {
        lon: 115.2339,
        lat: -8.6717,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Badung",
      "https://en.wikipedia.org/wiki/Denpasar"
    ],
    dateNote: {
      en: "Id.wiki gives 1788-1906 and the Puri Agung Denpasar seat. Zone uses Denpasar coordinates from en.wiki. No official Denpasar source opened.",
      id: "id.wiki memberi 1788-1906 dan pusat Puri Agung Denpasar. Zona memakai koordinat Denpasar dari en.wiki. Belum ada sumber resmi Denpasar yang dibuka."
    }
  },
  {
    id: "british-java",
    name: "Jawa masa Inggris",
    from: 1811,
    to: 1816,
    category: "colonial",
    region: "java",
    place: "Batavia (Jakarta), Java",
    placeId: "Batavia (Jakarta), Jawa",
    summary: {
      en: "British rule over Java from 1811 to 1816 under Lieutenant Governor Thomas Stamford Raffles. Dutch rule was restored in 1816.",
      id: "Pemerintahan Inggris atas Jawa 1811-1816 di bawah Letnan Gubernur Thomas Stamford Raffles. Pemerintahan Belanda dipulihkan pada 1816."
    },
    rulers: [
      {
        name: "Thomas Stamford Raffles (Letnan Gubernur)",
        from: 1811,
        to: 1816
      }
    ],
    zones: [
      {
        lon: 106.83,
        lat: -6.18,
        radiusKm: 300,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://reference.nlb.gov.sg/singapore/history/colonial-era/raffles-in-southeast-asia/"
    ],
    dateNote: {
      en: "NLB gives Raffles as Lieutenant Governor of Java 1811-1816. Batavia was the administrative seat; the zone uses Jakarta from en.wiki. No id.wiki or en.wiki article for this interregnum was opened, so the polity-article source is missing.",
      id: "NLB memberi Raffles sebagai Letnan Gubernur Jawa 1811-1816. Batavia adalah pusat administrasi; zona memakai Jakarta dari en.wiki. Artikel id.wiki atau en.wiki untuk interregnum ini belum dibuka, sehingga sumber artikel polity belum ada."
    }
  },
  {
    id: "pakualaman",
    name: "Kadipaten Pakualaman",
    from: 1813,
    to: 1944,
    category: "regional",
    region: "java",
    place: "Puro Pakualaman, Yogyakarta",
    placeId: "Puro Pakualaman, Yogyakarta",
    summary: {
      en: "A principality in Yogyakarta founded by Pangeran Natakusuma (Paku Alam I). Its founding is dated 1813, after his 1812 installation.",
      id: "Kadipaten di Yogyakarta yang didirikan Pangeran Natakusuma (Paku Alam I). Pendirian tercatat 1813, setelah pengangkatan 1812."
    },
    rulers: [
      {
        name: "Paku Alam I",
        from: 1813,
        to: 1829
      },
      {
        name: "Paku Alam II",
        from: 1829,
        to: 1858
      }
    ],
    zones: [
      {
        lon: 110.36444,
        lat: -7.80139,
        radiusKm: 20,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kadipaten_Pakualaman",
      "https://pakualamankec.jogjakota.go.id/page/index/sejarah"
    ],
    dateNote: {
      en: "Official page: installed 29 June 1812, founding date used 17 March 1813. Id.wiki gives 1813-present. Zone uses Yogyakarta city centre; the palace's own coordinates were not retrieved.",
      id: "Halaman resmi: diangkat 29 Juni 1812, tanggal pendirian 17 Maret 1813. id.wiki memberi 1813-sekarang. Zona memakai pusat kota Yogyakarta; koordinat istana tidak diperoleh."
    }
  },
  {
    id: "riau-lingga",
    name: "Kesultanan Riau-Lingga",
    from: 1824,
    to: 1911,
    category: "islamic",
    region: "sumatra",
    place: "Daik, Lingga Islands, Riau Islands province",
    placeId: "Daik, Kepulauan Lingga, Provinsi Kepulauan Riau",
    summary: {
      en: "A sultanate created under the 1824 Anglo-Dutch arrangement as a successor to Johor. The Dutch abolished it on 3 February 1911.",
      id: "Kesultanan yang dibentuk berdasarkan pengaturan Inggris-Belanda 1824 sebagai penerus Johor. Dihapus Belanda pada 3 Februari 1911."
    },
    rulers: [],
    zones: [
      {
        lon: 104.483,
        lat: -0.267,
        radiusKm: 60,
        confidence: "approximate-core"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kesultanan_Riau-Lingga",
      "https://kepri.kemenag.go.id/page/detartikel/28092017010906_kesultananlinggariau"
    ],
    dateNote: {
      en: "Id.wiki and the Kemenag Kepri page both give 1824-1911. The Kemenag page gives no explicit centre. Zone uses the Lingga Regency centroid, not a sourced seat. Riau Islands is the province, not Riau Province.",
      id: "id.wiki dan halaman Kemenag Kepri sama-sama memberi 1824-1911. Halaman Kemenag tidak menyebut pusat secara eksplisit. Zona memakai pusat Kabupaten Lingga, bukan pusat yang tersumber. Provinsi yang benar adalah Kepulauan Riau, bukan Provinsi Riau."
    }
  },
  {
    id: "dutch-new-guinea",
    name: "Nugini Belanda",
    from: 1828,
    to: 1942,
    category: "colonial",
    region: "papua",
    place: "Manokwari, western New Guinea",
    placeId: "Manokwari, Papua Barat",
    summary: {
      en: "The western half of New Guinea claimed by the Dutch in 1828, administered from posts including Fakfak and Manokwari from 1898. Japanese occupation from 1942 ended effective Dutch administration.",
      id: "Separuh barat Papua yang diklaim Belanda pada 1828, dikelola dari pos-pos termasuk Fakfak dan Manokwari sejak 1898. Pendudukan Jepang sejak 1942 mengakhiri administrasi Belanda yang efektif."
    },
    rulers: [],
    zones: [
      {
        lon: 134.083,
        lat: -0.867,
        radiusKm: 150,
        confidence: "attested-centre",
        from: 1898,
        to: 1942
      }
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Netherlands_New_Guinea",
      "https://vanderheijden.org/ng/history.html",
      "https://en.wikipedia.org/wiki/Manokwari"
    ],
    dateNote: {
      en: "1828 is the Dutch proclamation date. The 'to' date of 1942 is set at the Japanese invasion, as the source describes; formal Dutch sovereignty continued until 1962. Manokwari is one of the 1898 posts, with Fakfak the other.",
      id: "1828 is the Dutch proclamation date. The 'to' date of 1942 is set at the Japanese invasion, as the source describes; formal Dutch sovereignty continued until 1962. Manokwari is one of the 1898 posts, with Fakfak the other."
    }
  },
  {
    id: "sekar-fakfak",
    name: "Kerajaan Sekar (Fakfak)",
    from: 1896,
    to: 1942,
    category: "regional",
    region: "papua",
    place: "Sekar, Kokas, Fakfak, Onin Peninsula",
    placeId: "Sekar, Kokas, Fakfak, Semenanjung Onin",
    summary: {
      en: "An Islamic kingdom on the Onin peninsula near Fakfak, originally called Kabituwar and later recognised as separate. Tidore appointed a Sekar captain in 1896, and Dutch-backed rulers held office from 1911.",
      id: "Kerajaan Islam di Semenanjung Onin dekat Fakfak, semula disebut Kabituwar dan kemudian diakui berdiri sendiri. Sultan Tidore mengangkat kapitan Sekar pada 1896, dan raja-raja yang didukung Belanda memerintah sejak 1911."
    },
    rulers: [
      {
        name: "Lakate Heremba",
        from: 1899,
        to: 1911
      },
      {
        name: "Saban Pipi Rumagesan",
        from: 1911,
        to: 1915
      },
      {
        name: "Machmud Singgirei Rumagesan",
        from: 1915,
        to: 1942
      }
    ],
    zones: [
      {
        lon: 132.44247,
        lat: -2.70105,
        radiusKm: 30,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Sekar",
      "https://id.wikipedia.org/wiki/Sekar,_Kokas,_Fakfak"
    ],
    dateNote: {
      en: "From = 1896 (Tidore appointment of a Sekar captain), the earliest year tied to the polity in the source. To = 1942 (last year of Machmud Singgirei's reign per infobox, which ends the 1915-1942 entry). Lakate Heremba is marked 'sementara' (temporary) in the source. Coordinates are Sekar village, the stated capital.",
      id: "From = 1896 (Tidore appointment of a Sekar captain), the earliest year tied to the polity in the source. To = 1942 (last year of Machmud Singgirei's reign per infobox, which ends the 1915-1942 entry). Lakate Heremba is marked 'sementara' (temporary) in the source. Coordinates are Sekar village, the stated capital."
    }
  },
  {
    id: "manggarai",
    name: "Kerajaan Manggarai",
    from: 1924,
    to: 1944,
    category: "regional",
    region: "nusa-tenggara",
    place: "Ruteng, western Flores",
    placeId: "Ruteng, Flores Barat",
    summary: {
      en: "A Dutch-created self-governing principality on western Flores, centred at Ruteng, whose rulers were chosen locally. It became a regency in 1960.",
      id: "Kerajaan buatan Belanda di Flores Barat yang berpusat di Ruteng dengan raja yang dipilih secara lokal. Diubah menjadi kabupaten pada 1960."
    },
    rulers: [
      {
        name: "Bagoeng",
        from: 1924,
        to: 1930
      },
      {
        name: "Alexander Baroek",
        from: 1930,
        to: 1944
      }
    ],
    zones: [
      {
        lon: 120.378818,
        lat: -8.5863,
        radiusKm: 60,
        confidence: "attested-centre"
      }
    ],
    sources: [
      "https://id.wikipedia.org/wiki/Kerajaan_Manggarai",
      "https://id.wikipedia.org/wiki/Ruteng,_Manggarai"
    ],
    dateNote: {
      en: "Founded 1924 per source; the kingdom was dissolved in 1960. End capped at 1944. Baroek's reign runs to 1949 in the source, so his 'to' is capped at 1944.",
      id: "Founded 1924 per source; the kingdom was dissolved in 1960. End capped at 1944. Baroek's reign runs to 1949 in the source, so his 'to' is capped at 1944."
    }
  }
];
