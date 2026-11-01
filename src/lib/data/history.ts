/**
 * Pre-1945 Nusantara historical gazetteer.
 *
 * This is a curated catalogue of major polities, not an exhaustive dynasty census.
 * Date boundaries are approximate and inclusive. A heat zone marks an attested
 * centre or a hypothesised *sphere of influence*, NEVER a surveyed frontier.
 * Never derive area, sovereignty, present-day province ownership, or population
 * from the heat circles. Read docs/HISTORY.md before expanding coverage.
 */
export type Confidence = 'attested-centre' | 'approximate-core' | 'contested-influence';
export type HistoryRegion = 'sumatra' | 'java' | 'bali' | 'borneo' | 'sulawesi' | 'nusa-tenggara' | 'maluku' | 'papua' | 'malay-peninsula' | 'archipelago';
export type HistoryCategory = 'hindu-buddhist' | 'islamic' | 'regional' | 'colonial';
export interface HistoryRuler { name: string; from?: number; to?: number; uncertain?: boolean }
export interface HistoryZone { lon: number; lat: number; radiusKm: number; confidence: Confidence; from?: number; to?: number }
export interface HistoricalPolity {
  id: string; name: string; from: number; to: number;
  category: HistoryCategory; region: HistoryRegion; place: string; placeId: string;
  summary: { en: string; id: string };
  rulers: HistoryRuler[]; zones: HistoryZone[];
  sources: string[]; dateNote?: { en: string; id: string };
}
import { MORE_POLITIES } from './history-more.ts';
const wiki = 'https://id.wikipedia.org/wiki/Sejarah_Nusantara';
const big = 'https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_MasaIndonesiaKlasik/MapServer';
const yupa = 'https://suarbetang.kemdikbud.go.id/jurnal/index.php/BETANG/article/viewFile/113/104';
const mataram = 'https://berkalaarkeologi.kemdikbud.go.id/index.php/berkalaarkeologi/article/download/721/655/3286';
const prasasti = 'https://berkalaarkeologi.kemdikbud.go.id/index.php/berkalaarkeologi/article/download/591/555/3111';
const yogya = 'https://budaya.data.kemdikbud.go.id/cagarbudaya/objek/KB000089';
const c = (lon: number, lat: number, radiusKm: number, confidence: Confidence = 'approximate-core', from?: number, to?: number): HistoryZone => ({ lon,lat,radiusKm,confidence,from,to });
/** Each date span is capped at 1944 even where the institution survived independence. */
const CORE_POLITIES: HistoricalPolity[] = [
  { id:'kutai-martadipura',name:'Kutai Martadipura',from:400,to:600,category:'hindu-buddhist',place:'Muara Kaman, East Kalimantan',placeId:'Muara Kaman, Kalimantan Timur',region:'borneo',
    summary:{en:'The early Mahakam River polity is attested by fifth-century yupa inscriptions recording the genealogy and gifts of Mulawarman. The inscriptions do not give it the later name “Kutai”.',id:'Kerajaan awal di Sungai Mahakam dikenal melalui prasasti yupa abad ke-5 yang mencatat silsilah serta pemberian Mulawarman. Nama “Kutai” sendiri tidak disebut dalam prasasti itu.'},
    rulers:[{name:'Kudungga'},{name:'Aswawarman'},{name:'Mulawarman'}],
    zones:[c(116.93,-0.38,65,'attested-centre')],sources:[yupa,wiki],dateNote:{en:'Fifth-century inscriptions; exact founding and end dates unknown.',id:'Prasasti abad ke-5; tahun pendirian dan berakhirnya tidak diketahui pasti.'} },
  { id:'tarumanagara',name:'Tarumanagara',from:400,to:700,category:'hindu-buddhist',place:'Western Java',placeId:'Jawa Barat',region:'java',
    summary:{en:'An early Hindu polity in western Java, documented by inscriptions associated with King Purnawarman; its political limits are not known.',id:'Kerajaan Hindu awal di Jawa Barat yang dikenal melalui prasasti terkait Raja Purnawarman; batas kekuasaannya belum dapat dipastikan.'},
    rulers:[{name:'Purnawarman'}],zones:[c(106.8,-6.42,110,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/26567/",wiki] },
  { id:'kalingga',name:'Kalingga (Ho-ling)',from:600,to:800,category:'hindu-buddhist',place:'Northern Central Java',placeId:'Jawa Tengah bagian utara',region:'java',
    summary:{en:'A Central Javanese polity identified cautiously with Ho-ling in Chinese accounts; traditions about Queen Shima must be separated from contemporary evidence.',id:'Kerajaan di Jawa Tengah yang sering dikaitkan dengan Ho-ling dalam berita Tiongkok; kisah Ratu Shima perlu dibedakan dari bukti sezaman.'},
    rulers:[{name:'Ratu Shima',uncertain:true}],zones:[c(110.6,-6.62,92,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/27794/1/MODUL%20AJAR%20KLS%204%20SMS%202.pdf",wiki] },
  { id:'srivijaya',name:'Sriwijaya',from:682,to:1250,category:'hindu-buddhist',place:'Southern Sumatra and the Malacca Strait',placeId:'Sumatra Selatan dan Selat Malaka',region:'sumatra',
    summary:{en:'A Buddhist maritime network anchored in southern Sumatra, attested by the 682 Kedukan Bukit inscription and foreign travellers. Influence over ports was not uniform direct rule.',id:'Jaringan maritim Buddha berpusat di Sumatra selatan, dibuktikan prasasti Kedukan Bukit (682) dan catatan musafir asing. Pengaruh atas pelabuhan tidak selalu berupa pemerintahan langsung.'},
    rulers:[{name:'Dapunta Hyang Sri Jayanasa',from:682,to:700},{name:'Balaputradewa',from:850,to:870},{name:'Sangramavijayottunggavarman',from:1000,to:1025}],
    zones:[c(104.76,-2.99,150,'attested-centre'),c(103.6,-1.55,150,'approximate-core'),c(100.5,3,330,'contested-influence',750,1100)],sources:["https://repositori.kemendikdasmen.go.id/23858/",prasasti,wiki] },
  { id:'sunda',name:'Sunda / Pajajaran',from:669,to:1579,category:'hindu-buddhist',place:'Western Java',placeId:'Jawa Barat',region:'java',
    summary:{en:'A long-lived Sundanese royal tradition with changing courts and alliances. Pakuan Pajajaran became an important late royal centre before Banten’s expansion.',id:'Tradisi kerajaan Sunda berlangsung lama dengan pusat istana dan hubungan politik yang berubah. Pakuan Pajajaran menjadi pusat penting pada masa akhir sebelum perluasan Banten.'},
    rulers:[{name:'Sri Baduga Maharaja',from:1482,to:1521},{name:'Surawisesa',from:1521,to:1535}],
    zones:[c(106.8,-6.6,125,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kerajaan_Sunda'] },
  { id:'medang',name:'Medang (Mataram Kuno)',from:732,to:1016,category:'hindu-buddhist',place:'Central then Eastern Java',placeId:'Jawa Tengah lalu Jawa Timur',region:'java',
    summary:{en:'The Sanjaya and Sailendra-associated courts left temple complexes and dated inscriptions; the main royal centre shifted east in the tenth century.',id:'Istana yang berkaitan dengan wangsa Sanjaya dan Sailendra meninggalkan candi serta prasasti bertanggal; pusat kerajaan bergeser ke Jawa Timur pada abad ke-10.'},
    rulers:[{name:'Sanjaya',from:732,to:746},{name:'Rakai Panangkaran',from:746,to:784},{name:'Rakai Pikatan',from:847,to:855},{name:'Balitung',from:898,to:910},{name:'Mpu Sindok',from:929,to:947},{name:'Dharmawangsa',from:990,to:1016}],
    zones:[c(110.45,-7.78,150,'approximate-core',732,929),c(112.55,-7.57,140,'approximate-core',929,1016)],sources:["https://repositori.kemendikdasmen.go.id/21612/1/X_Sejarah-Indonesia_KD-3.6_Final.pdf",mataram,wiki] },
  { id:'bali-warmadewa',name:'Wangsa Warmadewa (Bali)',from:914,to:1343,category:'hindu-buddhist',place:'Bali',placeId:'Bali',region:'bali',
    summary:{en:'Bali’s early royal inscriptions name members of the Warmadewa line, followed by closely linked Balinese courts and cultural exchanges with Java.',id:'Prasasti awal Bali menyebut anggota wangsa Warmadewa, disusul istana-istana Bali yang memiliki hubungan budaya dan politik dengan Jawa.'},
    rulers:[{name:'Sri Kesari Warmadewa'},{name:'Udayana Warmadewa',from:989,to:1011},{name:'Anak Wungsu',from:1049,to:1077}],
    zones:[c(115.3,-8.42,95,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Dinasti_Warmadewa'] },
  { id:'kahuripan',name:'Kahuripan',from:1019,to:1045,category:'hindu-buddhist',place:'Eastern Java',placeId:'Jawa Timur',region:'java',
    summary:{en:'Airlangga rebuilt royal authority in eastern Java after the collapse of an earlier court; later chronicles connect his succession with the Janggala and Kediri division.',id:'Airlangga memulihkan kekuasaan di Jawa Timur setelah runtuhnya kerajaan sebelumnya; sumber kemudian mengaitkan suksesi dengan pembagian Janggala dan Kediri.'},
    rulers:[{name:'Airlangga',from:1019,to:1045}],zones:[c(112.55,-7.5,115,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/21612/1/X_Sejarah-Indonesia_KD-3.6_Final.pdf",wiki] },
  { id:'kediri',name:'Kadiri / Kediri',from:1042,to:1222,category:'hindu-buddhist',place:'Brantas valley, Eastern Java',placeId:'Lembah Brantas, Jawa Timur',region:'java',
    summary:{en:'An East Javanese court celebrated for Old Javanese literature and royal patronage, ending after defeat by forces led by Ken Arok.',id:'Kerajaan di lembah Brantas dikenal melalui sastra Jawa Kuno dan dukungan raja-rajanya; kekuasaan berakhir setelah dikalahkan pasukan Ken Arok.'},
    rulers:[{name:'Jayabhaya',from:1135,to:1159},{name:'Kameswara',from:1182,to:1194},{name:'Kertajaya',from:1194,to:1222}],
    zones:[c(112,-7.8,125,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/36018/1/Hindu-BS-KLS-VII.pdf",wiki] },
  { id:'singhasari',name:'Singhasari',from:1222,to:1292,category:'hindu-buddhist',place:'Malang, Eastern Java',placeId:'Malang, Jawa Timur',region:'java',
    summary:{en:'Ken Arok’s successor court rose in eastern Java. Kertanagara pursued outward alliances and campaigns before the dynasty fell in 1292.',id:'Kerajaan penerus Ken Arok tumbuh di Jawa Timur. Kertanagara melakukan hubungan dan ekspedisi ke luar Jawa sebelum kerajaan runtuh pada 1292.'},
    rulers:[{name:'Ken Arok',from:1222,to:1227},{name:'Anusapati',from:1227,to:1248},{name:'Wisnuwardhana',from:1248,to:1268},{name:'Kertanagara',from:1268,to:1292}],
    zones:[c(112.66,-7.98,105,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/27794/1/MODUL%20AJAR%20KLS%204%20SMS%202.pdf",wiki] },
  { id:'ternate',name:'Kesultanan Ternate',from:1257,to:1914,category:'islamic',place:'Ternate, North Maluku',placeId:'Ternate, Maluku Utara',region:'maluku',
    summary:{en:'A spice-trading sultanate centred on Ternate, involved in far-reaching diplomacy and rivalry with Tidore and European powers.',id:'Kesultanan perdagangan rempah yang berpusat di Ternate, terlibat diplomasi luas dan persaingan dengan Tidore serta kekuatan Eropa.'},
    rulers:[{name:'Baabullah',from:1570,to:1583},{name:'Sultan Hamzah',from:1627,to:1648}],zones:[c(127.38,0.79,65,'attested-centre'),c(126.5,1.5,125,'contested-influence',1500,1700)],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Ternate'] },
  { id:'samudra-pasai',name:'Samudra Pasai',from:1267,to:1521,category:'islamic',place:'Northern Aceh',placeId:'Aceh Utara',region:'sumatra',
    summary:{en:'A major early Muslim port kingdom on north Sumatra, known from tombstones, trade networks and travellers’ accounts.',id:'Kerajaan pelabuhan Islam awal yang penting di pesisir utara Sumatra, dikenal melalui batu nisan, jaringan perdagangan, dan catatan pengelana.'},
    rulers:[{name:'Malik al-Salih',to:1297},{name:'Malik az-Zahir',from:1297,to:1326}],
    zones:[c(97.15,5.2,105,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'majapahit',name:'Majapahit',from:1293,to:1527,category:'hindu-buddhist',place:'Trowulan, Eastern Java',placeId:'Trowulan, Jawa Timur',region:'java',
    summary:{en:'An East Javanese court founded by Raden Wijaya, prominent under Hayam Wuruk and Gajah Mada. The Nagarakretagama lists distant places but does not prove uniform direct administration.',id:'Kerajaan Jawa Timur didirikan Raden Wijaya dan menonjol pada masa Hayam Wuruk serta Gajah Mada. Daftar daerah dalam Nagarakretagama tidak membuktikan pemerintahan langsung yang seragam.'},
    rulers:[{name:'Raden Wijaya',from:1293,to:1309},{name:'Tribhuwana Wijayatunggadewi',from:1328,to:1350},{name:'Hayam Wuruk',from:1350,to:1389},{name:'Wikramawardhana',from:1389,to:1429}],
    zones:[c(112.4,-7.57,195,'attested-centre'),c(115,-8.3,125,'contested-influence',1343,1450),c(106.5,-2.8,250,'contested-influence',1350,1400),c(117,-1.4,210,'contested-influence',1350,1400)],sources:["https://repositori.kemendikdasmen.go.id/2054/1/Buku%20Majapahit2.pdf",big,wiki],dateNote:{en:'End dates 1478 and 1527 differ across traditions; 1527 is used as an outer historical limit.',id:'Tahun akhir 1478 dan 1527 berbeda antartradisi; 1527 dipakai sebagai batas luar sejarah.'} },
  { id:'bone',name:'Kerajaan Bone',from:1300,to:1905,category:'regional',place:'South Sulawesi',placeId:'Sulawesi Selatan',region:'sulawesi',
    summary:{en:'A Bugis kingdom with its own aristocratic institutions and treaties, sometimes allied with and sometimes opposed to Gowa.',id:'Kerajaan Bugis dengan lembaga bangsawan dan perjanjian politik sendiri, pernah bersekutu dan juga berhadapan dengan Gowa.'},
    rulers:[{name:'Arung Palakka',from:1672,to:1696}],zones:[c(120.3,-4.54,125,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kerajaan_Bone'] },
  { id:'gowa-tallo',name:'Gowa–Tallo',from:1320,to:1669,category:'islamic',place:'Makassar, South Sulawesi',placeId:'Makassar, Sulawesi Selatan',region:'sulawesi',
    summary:{en:'The paired Makassar courts built a maritime trading power; Islam was adopted by rulers in the early seventeenth century, before defeat in the Makassar War.',id:'Kerajaan kembar di Makassar berkembang sebagai kekuatan niaga maritim; penguasanya menerima Islam pada awal abad ke-17 sebelum kalah dalam Perang Makassar.'},
    rulers:[{name:'Sultan Alauddin',from:1593,to:1639},{name:'Sultan Hasanuddin',from:1653,to:1669}],
    zones:[c(119.45,-5.15,150,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Gowa'] },
  { id:'pagaruyung',name:'Pagaruyung',from:1347,to:1833,category:'regional',place:'Minangkabau Highlands, West Sumatra',placeId:'Dataran Tinggi Minangkabau, Sumatra Barat',region:'sumatra',
    summary:{en:'The Minangkabau royal centre emerged from Adityawarman’s fourteenth-century inscriptions; later influence and the court’s authority varied over time.',id:'Pusat kerajaan Minangkabau terkait dengan prasasti Adityawarman abad ke-14; pengaruh wilayah dan kewibawaan istana berubah sepanjang waktu.'},
    rulers:[{name:'Adityawarman',from:1347,to:1375}],zones:[c(100.5,-0.45,145,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'brunei',name:'Kesultanan Brunei',from:1368,to:1944,category:'islamic',place:'Northern Borneo',placeId:'Borneo bagian utara',region:'borneo',
    summary:{en:'An independent Bornean maritime sultanate whose historical connections span the wider Nusantara; it is not a predecessor state of modern Indonesia.',id:'Kesultanan maritim mandiri di Kalimantan utara dengan hubungan historis ke Nusantara yang lebih luas; bukan negara pendahulu Indonesia modern.'},
    rulers:[{name:'Sultan Bolkiah',from:1485,to:1524}],zones:[c(114.94,4.9,115,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Brunei'] },
  { id:'tidore',name:'Kesultanan Tidore',from:1450,to:1944,category:'islamic',place:'Tidore, North Maluku',placeId:'Tidore, Maluku Utara',region:'maluku',
    summary:{en:'A spice-island sultanate with changing influence in the eastern islands and Papua, frequently competing and negotiating with Ternate and foreign powers.',id:'Kesultanan pulau rempah dengan pengaruh yang berubah di kepulauan timur dan Papua, sering bersaing dan berunding dengan Ternate serta kekuatan asing.'},
    rulers:[{name:'Sultan Nuku',from:1797,to:1805}],zones:[c(127.4,0.68,62,'attested-centre'),c(130,-1,180,'contested-influence',1750,1840)],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Tidore'],dateNote:{en:'Foundation traditions predate securely documented reigns.',id:'Tradisi pendirian lebih tua daripada masa pemerintahan yang terdokumentasi dengan kuat.'} },
  { id:'demak',name:'Kesultanan Demak',from:1475,to:1554,category:'islamic',place:'North Coast of Central Java',placeId:'Pesisir utara Jawa Tengah',region:'java',
    summary:{en:'An early Muslim royal centre on the north coast of Java, active in port politics and campaigns after Majapahit’s decline.',id:'Pusat kerajaan Islam awal di pesisir utara Jawa yang aktif dalam perdagangan pelabuhan dan ekspedisi setelah melemahnya Majapahit.'},
    rulers:[{name:'Raden Patah',from:1475,to:1518},{name:'Pati Unus',from:1518,to:1521},{name:'Sultan Trenggana',from:1521,to:1546}],
    zones:[c(110.64,-6.89,125,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Demak'] },
  { id:'aceh',name:'Kesultanan Aceh',from:1496,to:1903,category:'islamic',place:'Northern Sumatra',placeId:'Sumatra bagian utara',region:'sumatra',
    summary:{en:'A major Muslim power at the mouth of the Malacca Strait, especially influential under Iskandar Muda before enduring conflict with Dutch expansion.',id:'Kekuatan Islam penting di pintu Selat Malaka, sangat berpengaruh pada masa Iskandar Muda sebelum menghadapi ekspansi kolonial Belanda.'},
    rulers:[{name:'Ali Mughayat Syah',from:1496,to:1530},{name:'Iskandar Muda',from:1607,to:1636},{name:'Taj ul-Alam Safiatuddin',from:1641,to:1675}],
    zones:[c(95.34,5.55,150,'attested-centre'),c(98.4,3.25,220,'contested-influence',1607,1640)],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'cirebon',name:'Kesultanan Cirebon',from:1479,to:1677,category:'islamic',place:'Cirebon, West Java',placeId:'Cirebon, Jawa Barat',region:'java',
    summary:{en:'A north-coast Javanese Islamic court whose later succession produced several Cirebon palace lineages rather than a single continuous ruler.',id:'Kerajaan Islam pesisir utara Jawa yang kemudian melahirkan beberapa garis keraton Cirebon, bukan satu garis penguasa tunggal.'},
    rulers:[{name:'Sunan Gunung Jati',from:1479,to:1568},{name:'Panembahan Ratu',from:1570,to:1649}],zones:[c(108.56,-6.73,80,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Cirebon'] },
  { id:'banten',name:'Kesultanan Banten',from:1526,to:1813,category:'islamic',place:'Western Java',placeId:'Banten, Jawa Barat',region:'java',
    summary:{en:'A western Javanese sultanate enriched by pepper trade and a busy port, later constrained by VOC intervention and colonial rule.',id:'Kesultanan di Jawa Barat yang berkembang lewat perdagangan lada dan pelabuhan, kemudian dibatasi intervensi VOC dan kekuasaan kolonial.'},
    rulers:[{name:'Maulana Hasanuddin',from:1552,to:1570},{name:'Sultan Ageng Tirtayasa',from:1651,to:1683}],
    zones:[c(106.16,-6.04,110,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Banten'] },
  { id:'banjar',name:'Kesultanan Banjar',from:1526,to:1860,category:'islamic',place:'South Kalimantan',placeId:'Kalimantan Selatan',region:'borneo',
    summary:{en:'A South Bornean sultanate connected to river-borne trade and Islamic scholarship; Dutch intervention escalated in the nineteenth century.',id:'Kesultanan Kalimantan Selatan yang bertumpu pada perdagangan sungai dan tradisi keilmuan Islam; intervensi Belanda meningkat pada abad ke-19.'},
    rulers:[{name:'Sultan Suriansyah',from:1526,to:1550},{name:'Sultan Adam',from:1825,to:1857}],
    zones:[c(114.6,-3.32,155,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Banjar'] },
  { id:'pajang',name:'Kesultanan Pajang',from:1568,to:1587,category:'islamic',place:'Pajang, Central Java',placeId:'Pajang, Jawa Tengah',region:'java',
    summary:{en:'A short-lived inland Javanese Muslim kingdom between Demak and the rise of the Mataram Sultanate.',id:'Kerajaan Islam pedalaman Jawa yang berumur singkat, menghubungkan masa Demak dan kebangkitan Kesultanan Mataram.'},
    rulers:[{name:'Jaka Tingkir (Hadiwijaya)',from:1568,to:1582}],zones:[c(110.77,-7.57,90,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Pajang'] },
  { id:'mataram-islam',name:'Kesultanan Mataram',from:1586,to:1755,category:'islamic',place:'Central Java',placeId:'Jawa Tengah',region:'java',
    summary:{en:'An inland Javanese Islamic monarchy that expanded under Sultan Agung and was later partitioned through dynastic conflict and treaties.',id:'Monarki Islam pedalaman Jawa meluas pada masa Sultan Agung lalu terpecah melalui konflik suksesi dan perjanjian politik.'},
    rulers:[{name:'Panembahan Senapati',from:1586,to:1601},{name:'Sultan Agung',from:1613,to:1645},{name:'Amangkurat I',from:1646,to:1677}],
    zones:[c(110.4,-7.87,165,'approximate-core'),c(111.6,-7.2,155,'contested-influence',1620,1680)],sources:[yogya,wiki] },
  { id:'jambi',name:'Kesultanan Jambi',from:1615,to:1904,category:'islamic',place:'Jambi, Sumatra',placeId:'Jambi, Sumatra',region:'sumatra',
    summary:{en:'A Malay riverine sultanate at Jambi, linked to inland trade and changing Dutch treaties before colonial annexation.',id:'Kesultanan Melayu di sepanjang sungai Jambi, terhubung dengan perdagangan pedalaman dan perjanjian kolonial yang terus berubah.'},
    rulers:[{name:'Sultan Thaha Syaifuddin',from:1855,to:1904}],zones:[c(103.61,-1.6,120,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'bima',name:'Kesultanan Bima',from:1620,to:1944,category:'islamic',place:'Sumbawa, West Nusa Tenggara',placeId:'Sumbawa, Nusa Tenggara Barat',region:'nusa-tenggara',
    summary:{en:'A kingdom on eastern Sumbawa whose court adopted Islam in the seventeenth century and maintained long political ties with Sulawesi and colonial authorities.',id:'Kerajaan di Sumbawa timur dengan istana yang memeluk Islam pada abad ke-17 serta memiliki hubungan politik panjang dengan Sulawesi dan penguasa kolonial.'},
    rulers:[{name:'Sultan Abdul Kahir',from:1620,to:1640}],zones:[c(118.73,-8.46,95,'approximate-core')],sources:[wiki,'https://id.wikipedia.org/wiki/Kesultanan_Bima'] },
  { id:'sambas',name:'Kesultanan Sambas',from:1630,to:1944,category:'islamic',place:'West Kalimantan',placeId:'Kalimantan Barat',region:'borneo',
    summary:{en:'A northwestern Bornean sultanate with Malay and Bugis dynastic connections and a long succession recorded in manuscripts.',id:'Kesultanan Kalimantan barat laut dengan hubungan dinasti Melayu dan Bugis serta silsilah panjang dalam naskah sejarah.'},
    rulers:[{name:'Sultan Muhammad Syafiuddin I',from:1630,to:1669},{name:'Sultan Muhammad Syafiuddin II',from:1866,to:1922}],
    zones:[c(109.3,1.35,115,'approximate-core')],sources:['https://download.garuda.kemdikbud.go.id/article.php?article=896081&title=MELACAK+HUBUNGAN+KESULTANAN+SAMBAS+DAN+BUGIS+Studi+Awal+terhadap+Naskah+Tuhfat+al-Nafis&val=14028',wiki] },
  { id:'palembang',name:'Kesultanan Palembang Darussalam',from:1659,to:1823,category:'islamic',place:'Palembang, South Sumatra',placeId:'Palembang, Sumatra Selatan',region:'sumatra',
    summary:{en:'A Malay sultanate on the Musi River that developed after Sriwijaya; its leadership resisted expanding Dutch influence in the early nineteenth century.',id:'Kesultanan Melayu di Sungai Musi yang muncul jauh setelah Sriwijaya; para penguasanya melawan meluasnya pengaruh Belanda pada awal abad ke-19.'},
    rulers:[{name:'Sultan Mahmud Badaruddin II',from:1804,to:1821}],
    zones:[c(104.75,-2.98,120,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'siak',name:'Kesultanan Siak Sri Indrapura',from:1723,to:1944,category:'islamic',place:'East Coast of Sumatra',placeId:'Pesisir timur Sumatra',region:'sumatra',
    summary:{en:'An east Sumatran Malay sultanate with commercial links across the Straits of Malacca, surviving institutionally until Indonesian independence.',id:'Kesultanan Melayu di pesisir timur Sumatra dengan jaringan niaga lintas Selat Malaka; lembaganya bertahan hingga masa kemerdekaan Indonesia.'},
    rulers:[{name:'Raja Kecil',from:1723,to:1746},{name:'Sultan Syarif Kasim II',from:1915,to:1944}],
    zones:[c(102.03,0.81,155,'approximate-core')],sources:["https://repositori.kemendikdasmen.go.id/23858/",wiki] },
  { id:'surakarta',name:'Kasunanan Surakarta',from:1745,to:1944,category:'regional',place:'Surakarta, Central Java',placeId:'Surakarta, Jawa Tengah',region:'java',
    summary:{en:'A successor court of Islamic Mataram established in Surakarta; its political authority changed with the Dutch state while royal culture continued.',id:'Keraton penerus Mataram Islam yang berpusat di Surakarta; kewenangan politiknya berubah di bawah pemerintahan Belanda sementara tradisi keraton berlanjut.'},
    rulers:[{name:'Pakubuwana III',from:1749,to:1788},{name:'Pakubuwana X',from:1893,to:1939}],
    zones:[c(110.82,-7.57,90,'attested-centre')],sources:[yogya,wiki] },
  { id:'yogyakarta',name:'Kesultanan Yogyakarta',from:1755,to:1944,category:'regional',place:'Yogyakarta',placeId:'Yogyakarta',region:'java',
    summary:{en:'Founded following the 1755 Giyanti Treaty under Hamengkubuwana I; Yogyakarta’s royal institution continued beyond the atlas’s pre-independence cutoff.',id:'Berdiri setelah Perjanjian Giyanti 1755 di bawah Hamengkubuwana I; lembaga Kesultanan Yogyakarta tetap berlanjut setelah batas waktu peta pra-kemerdekaan.'},
    rulers:[{name:'Hamengkubuwana I',from:1755,to:1792},{name:'Hamengkubuwana IX',from:1940,to:1944}],
    zones:[c(110.36,-7.8,90,'attested-centre')],sources:[yogya,wiki] },
  { id:'voc',name:'VOC',from:1602,to:1799,category:'colonial',place:'Batavia and Dutch trading posts',placeId:'Batavia dan pos dagang Belanda',region:'archipelago',
    summary:{en:'The Dutch East India Company controlled fortified ports and negotiated uneven treaties; its commercial empire overlapped with independent local polities.',id:'VOC menguasai benteng dan pelabuhan serta membuat perjanjian yang tidak seragam; kekuasaan niaganya berdampingan dengan kerajaan setempat yang tetap mandiri.'},
    rulers:[{name:'Pieter Both',from:1610,to:1614},{name:'Gerard Reynst',from:1614,to:1615},{name:'Laurens Reael',from:1616,to:1619},{name:'Jan Pieterszoon Coen',from:1618,to:1623},{name:'Pieter de Carpentier',from:1623,to:1627},{name:'Jan Pieterszoon Coen',from:1627,to:1629},{name:'Jacques Specx',from:1629,to:1632},{name:'Hendrik Brouwer',from:1632,to:1636},{name:'Antonio van Diemen',from:1636,to:1645},{name:'Cornelis van der Lijn',from:1645,to:1650},{name:'Carel Reyniersz',from:1650,to:1653},{name:'Joan Maetsuyker',from:1653,to:1678},{name:'Rijcklof van Goens',from:1678,to:1681},{name:'Cornelis Speelman',from:1681,to:1684},{name:'Joannes Camphuys',from:1684,to:1691},{name:'Willem van Outhoorn',from:1691,to:1704},{name:'Johan van Hoorn',from:1704,to:1709},{name:'Abraham van Riebeeck',from:1709,to:1713},{name:'Christoffel van Swoll',from:1713,to:1718},{name:'Henricus Zwaardecroon',from:1718,to:1725},{name:'Matthaeus de Haan',from:1725,to:1729},{name:'Diederik Durven',from:1729,to:1731},{name:'Dirk van Cloon',from:1732,to:1735},{name:'Abraham Patras',from:1735,to:1737},{name:'Adriaan Valckenier',from:1737,to:1741},{name:'Johannes Thedens',from:1741,to:1743},{name:'Gustaaf Willem van Imhoff',from:1743,to:1750},{name:'Jacob Mossel',from:1750,to:1761},{name:'Petrus Albertus van der Parra',from:1761,to:1775},{name:'Jeremias van Riemsdijk',from:1775,to:1777},{name:'Reinier de Klerk',from:1777,to:1780},{name:'Willem Arnold Alting',from:1780,to:1796},{name:'Peter Gerhardus van Overstraten',from:1796,to:1799}],zones:[c(106.84,-6.13,105,'attested-centre',1619,1799),c(112.75,-7.25,135,'contested-influence',1700,1799)],sources:[wiki,'https://id.wikipedia.org/wiki/VOC','https://www.worldstatesmen.org/Indonesia.htm'] },
  { id:'dutch-east-indies',name:'Hindia Belanda',from:1800,to:1942,category:'colonial',place:'Batavia / colonial administrative centres',placeId:'Batavia dan pusat administrasi kolonial',region:'archipelago',
    summary:{en:'Dutch colonial administration expanded unevenly over the nineteenth and early twentieth centuries; formal maps frequently overstate control before military campaigns.',id:'Administrasi kolonial Belanda meluas secara tidak merata selama abad ke-19 hingga awal abad ke-20; peta formal dapat melebihkan kendali sebelum penaklukan militer.'},
    rulers:[{name:'Johannes Siberg',from:1801,to:1804},{name:'Albertus Henricus Wiese',from:1804,to:1808},{name:'Herman Willem Daendels',from:1808,to:1811},{name:'Jan Willem Janssens',from:1811,to:1811},{name:'Cornelis Theodorus Elout',from:1816,to:1819},{name:'Godert Alexander Gerard Philip van der Capellen',from:1819,to:1826},{name:'Leonard Pierre Joseph burggraaf du Bus de Gisignies',from:1826,to:1830},{name:'Hendrik Merkus de Kock',from:1826,to:1830},{name:'Johannes van den Bosch',from:1830,to:1833},{name:'Jean Chrétien Baud',from:1833,to:1836},{name:'Dominique Jacques de Eerens',from:1836,to:1840},{name:'Carel Sirardus Willem graaf van Hogendorp',from:1840,to:1841},{name:'Pieter Merkus',from:1841,to:1844},{name:'Jan Cornelis van Reijnst',from:1844,to:1845},{name:'Jan Jacob Rochussen',from:1845,to:1851},{name:'Albertus Jacobus Duymaer van Twist',from:1851,to:1856},{name:'Charles Ferdinand Pahud',from:1856,to:1861},{name:'Ary Prins',from:1861,to:1861},{name:'Ludolph Anne Jan Wilt baron Sloet van de Beele',from:1861,to:1866},{name:'Ary Prins',from:1866,to:1866},{name:'Pieter Mijer',from:1866,to:1872},{name:'James Loudon',from:1872,to:1875},{name:'Johan Wilhelm van Lansberge',from:1875,to:1881},{name:'Frederik s\'Jacob',from:1881,to:1884},{name:'Otto van Rees',from:1884,to:1888},{name:'Cornelis Pijnacker Hordijk',from:1888,to:1893},{name:'Carel Herman Aart van der Wijck',from:1893,to:1899},{name:'Willem Rooseboom',from:1899,to:1904},{name:'Joannes Benedictus van Heutsz',from:1904,to:1909},{name:'Alexander Willem Frederik Idenburg',from:1909,to:1916},{name:'Johan Paul graaf van Limburg Stirum',from:1916,to:1921},{name:'Dirk Fock',from:1921,to:1926},{name:'Andries Cornelis Dirk de Graeff',from:1926,to:1931},{name:'Bonifacius Cornelis de Jonge',from:1931,to:1936},{name:'Alidius Warmoldus Lambertus Tjarda van Starkenborgh Stachouwer',from:1936,to:1942}],zones:[c(106.85,-6.17,150,'attested-centre'),c(110.5,-7.3,250,'approximate-core',1850,1942),c(104,-2.4,190,'contested-influence',1900,1942),c(116,-1.9,200,'contested-influence',1900,1942)],sources:[wiki,'https://id.wikipedia.org/wiki/Hindia_Belanda','https://www.worldstatesmen.org/Indonesia.htm'] },
  { id:'japanese-occupation',name:'Pendudukan Jepang',from:1942,to:1944,category:'colonial',place:'Occupied territories of the former Dutch East Indies',placeId:'Wilayah bekas Hindia Belanda yang diduduki',region:'archipelago',
    summary:{en:'Japanese wartime military rule displaced Dutch authority from 1942, before the Indonesian declaration of independence in August 1945.',id:'Pemerintahan militer Jepang menggantikan otoritas Belanda mulai 1942, sebelum Proklamasi Kemerdekaan Indonesia pada Agustus 1945.'},
    rulers:[{name:'Hitoshi Imamura (Java)',from:1942,to:1942},{name:'Kumakichi Harada (Java)',from:1942,to:1945},{name:'Yūichirō Nagano (Java)',from:1945,to:1945},{name:'Tomoyuki Yamashita (Sumatra)',from:1942,to:1942},{name:'Yaheita Saitō (Sumatra)',from:1942,to:1943},{name:'Moritake Tanabe (Sumatra)',from:1943,to:1945},{name:'Ibō Takahashi (Borneo and eastern islands)',from:1942,to:1942},{name:'Shirō Takasu (Borneo and eastern islands)',from:1942,to:1944},{name:'Gun\'ichi Mikawa (Borneo and eastern islands)',from:1944,to:1944},{name:'Ōkawachi Denshichi (Borneo and eastern islands)',from:1944,to:1945}],zones:[c(110.5,-7.3,230,'approximate-core'),c(103,-2.4,200,'contested-influence'),c(116,-2,195,'contested-influence')],sources:[wiki,'https://id.wikipedia.org/wiki/Pendudukan_Jepang_di_Hindia_Belanda','https://www.worldstatesmen.org/Indonesia.htm'] }
];

/** Chronological milestones have independent attestations; timelines need not imply dynastic succession. */
/** Core records plus the extended gazetteer in history-more.ts, ordered by start year. */
export const HISTORICAL_POLITIES: HistoricalPolity[] = [...CORE_POLITIES, ...MORE_POLITIES]
  .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));
export const HISTORY_EVENTS = [
  { year:-400, en:'Buni archaeological culture (not a kingdom)', id:'Kebudayaan arkeologis Buni (bukan kerajaan)' },
  { year:400, en:'Early Kutai and Tarumanagara inscriptions', id:'Prasasti awal Kutai dan Tarumanagara' },
  { year:682, en:'Kedukan Bukit inscription records Sriwijaya', id:'Prasasti Kedukan Bukit mencatat Sriwijaya' },
  { year:732, en:'Canggal inscription and early Medang', id:'Prasasti Canggal dan Medang awal' },
  { year:929, en:'Medang power centre shifts east', id:'Pusat kekuasaan Medang bergeser ke timur' },
  { year:1019, en:'Airlangga consolidates Kahuripan', id:'Airlangga menyatukan Kahuripan' },
  { year:1222, en:'Singhasari replaces Kadiri', id:'Singhasari menggantikan Kadiri' },
  { year:1293, en:'Founding of Majapahit', id:'Pendirian Majapahit' },
  { year:1350, en:'Hayam Wuruk ascends the throne', id:'Hayam Wuruk naik takhta' },
  { year:1400, en:'Malacca is founded as a trading port (c. 1400)', id:'Malaka berdiri sebagai bandar dagang (sekitar 1400)' },
  { year:1475, en:'Demak rises on the north coast of Java', id:'Demak bangkit di pesisir utara Jawa' },
  { year:1511, en:'Portuguese capture Malacca', id:'Portugis merebut Malaka' },
  { year:1512, en:'Portuguese ships reach the Banda Islands and Maluku', id:'Kapal Portugis tiba di Kepulauan Banda dan Maluku' },
  { year:1526, en:'Banten and Banjar sultanates emerge', id:'Kesultanan Banten dan Banjar berkembang' },
  { year:1586, en:'Islamic Mataram emerges', id:'Mataram Islam berkembang' },
  { year:1596, en:'First Dutch expedition reaches Banten', id:'Ekspedisi Belanda pertama tiba di Banten' },
  { year:1602, en:'VOC is chartered', id:'VOC dibentuk' },
  { year:1619, en:'VOC establishes Batavia', id:'VOC mendirikan Batavia' },
  { year:1755, en:'Giyanti Treaty partitions Mataram', id:'Perjanjian Giyanti membagi Mataram' },
  { year:1799, en:'VOC dissolves', id:'VOC dibubarkan' },
  { year:1800, en:'Dutch colonial state succeeds VOC holdings', id:'Negara kolonial Belanda menggantikan aset VOC' },
  { year:1825, en:'Java War begins', id:'Perang Jawa dimulai' },
  { year:1873, en:'Aceh War begins', id:'Perang Aceh dimulai' },
  { year:1906, en:'Badung puputan in Bali', id:'Puputan Badung di Bali' },
  { year:1908, en:'Early Indonesian nationalist organisations', id:'Organisasi kebangsaan Indonesia awal' },
  { year:1928, en:'Youth Pledge', id:'Sumpah Pemuda' },
  { year:1942, en:'Japanese occupation begins', id:'Pendudukan Jepang dimulai' },
  { year:1944, en:'Last full year before Indonesian independence', id:'Tahun penuh terakhir sebelum kemerdekaan Indonesia' }
] as const;
export const HISTORY_MIN_YEAR = -400;
export const HISTORY_MAX_YEAR = 1944;
export const historyActive = (year: number): HistoricalPolity[] => HISTORICAL_POLITIES.filter(p => p.from <= year && year <= p.to);
/** Later Islamic titles must not be projected backward onto a polity's earlier period. */
export function historyCategoryAt(p: HistoricalPolity, year: number): HistoryCategory {
  if (p.id === 'ternate' && year < 1470) return 'regional';
  if (p.id === 'tidore' && year < 1490) return 'regional';
  if (p.id === 'gowa-tallo' && year < 1605) return 'regional';
  if (p.id === 'buton' && year < 1542) return 'regional';
  if (p.id === 'jailolo' && year < 1500) return 'regional';
  return p.category;
}
/** Sum of the radii of the zones active in a year: a rough, display-only ranking of how widely a polity is drawn. */
export function historyProminence(polity: HistoricalPolity, year: number): number {
  return polity.zones
    .filter(zone => (zone.from ?? polity.from) <= year && year <= (zone.to ?? polity.to))
    .reduce((total, zone) => total + zone.radiusKm, 0);
}
export function historyMostProminent(year: number): HistoricalPolity | undefined {
  const ranked = [...historyActive(year)].sort((a, b) => historyProminence(b, year) - historyProminence(a, year));
  return ranked[0];
}
export const historyZonesAt = (year: number) => historyActive(year).flatMap(polity =>
  polity.zones.filter(zone => (zone.from ?? polity.from) <= year && year <= (zone.to ?? polity.to))
    .map(zone => ({ ...zone, id: polity.id, name: polity.name, category: historyCategoryAt(polity, year), polity }))
);
export const historyRulersAt = (polity: HistoricalPolity, year: number): HistoryRuler[] =>
  polity.rulers.filter(r => r.from !== undefined && r.to !== undefined && r.from <= year && year <= r.to);
export function isHistoricalPolity(value: unknown): value is HistoricalPolity {
  if (!value || typeof value !== 'object') return false;
  const p = value as HistoricalPolity;
  return typeof p.id === 'string' && /^[-a-z0-9]+$/.test(p.id)
    && p.from >= HISTORY_MIN_YEAR && p.to <= HISTORY_MAX_YEAR && p.from <= p.to
    && typeof p.region === 'string' && typeof p.place === 'string' && typeof p.placeId === 'string'
    && Array.isArray(p.zones) && p.zones.length > 0
    && p.zones.every(z => Number.isFinite(z.lon) && Number.isFinite(z.lat) && Number.isFinite(z.radiusKm) && z.radiusKm > 0 && z.radiusKm <= 600
      && Math.abs(z.lon) <= 180 && Math.abs(z.lat) <= 90
      && ['attested-centre','approximate-core','contested-influence'].includes(z.confidence))
    && Array.isArray(p.sources) && p.sources.length > 0 && p.sources.every(s => s.startsWith('https://'));
}
