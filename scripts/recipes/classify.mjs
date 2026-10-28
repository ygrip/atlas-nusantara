/**
 * Name-based dish classification. Wikipedia's list gives no dish type, so the group is a heuristic on the dish name:
 * the first rule whose words appear in the name wins, and `other` means no rule matched. It filters the table; it is not
 * a culinary authority.
 */
import { dishKey } from './cookpad-parse.mjs';

/** Order matters: drinks and condiments are checked before the dishes that share their words ("es teler", "sambal goreng"). */
const RULES = [
  ['drinks', ['es', 'minuman', 'wedang', 'bajigur', 'bandrek', 'jamu', 'kopi', 'teh', 'sekoteng', 'dawet', 'cendol', 'sirup', 'sari', 'susu', 'tuak', 'cincau']],
  ['condiments', ['sambal', 'sambel', 'terasi', 'bumbu', 'dabu', 'kecap', 'petis', 'acar', 'abon', 'serundeng', 'saus', 'rica', 'bekasam']],
  ['noodles', ['mie', 'mi', 'bakmi', 'bihun', 'kwetiau', 'kwetiaw', 'laksa', 'soun', 'lomie', 'lomi', 'misoa']],
  ['soups', ['soto', 'sop', 'sup', 'rawon', 'bakso', 'coto', 'konro', 'gulai', 'kari', 'kare', 'opor', 'lodeh', 'tongseng', 'semur', 'brongkos', 'pindang', 'asam pedas', 'sayur asem', 'garang asem', 'tengkleng', 'kuah', 'kaldu', 'pallubasa', 'tekwan']],
  ['rice', ['nasi', 'lontong', 'ketupat', 'bubur', 'tumpeng', 'liwet', 'uduk', 'lemang', 'kebuli', 'timbel', 'ketan', 'lepet', 'songkolo', 'pulut']],
  ['snacks', ['kue', 'kripik', 'keripik', 'kerupuk', 'krupuk', 'martabak', 'risoles', 'risol', 'bakwan', 'batagor', 'siomay', 'tahu', 'tempe', 'cilok', 'cireng', 'lumpia', 'onde', 'getuk', 'klepon', 'dodol', 'lemper', 'pastel', 'wajik', 'dadar', 'serabi', 'kolak', 'bika', 'bolu', 'roti', 'donat', 'apem', 'jenang', 'bakpia', 'bakpao', 'pia', 'cenil', 'gethuk', 'tiwul', 'gatot', 'rengginang', 'emping', 'opak', 'rempeyek', 'peyek', 'pisang', 'singkong', 'ubi', 'talam', 'nagasari', 'cucur', 'lupis', 'putu', 'pukis', 'surabi', 'wingko', 'lapis', 'kembang', 'sagu', 'manisan', 'selai', 'cokelat', 'coklat', 'brem', 'madu', 'kerak', 'telur gulung', 'cakwe', 'cakue', 'combro', 'misro', 'gorengan', 'gembukan', 'kastengel', 'nastar', 'sarang', 'semprong', 'tape', 'kacang', 'lekker', 'amplang', 'nugget', 'otak', 'pempek', 'empek', 'kemplang', 'kroket', 'bipang', 'rujak', 'asinan', 'es krim', 'puding', 'pudding', 'agar', 'dessert', 'jajan', 'jajanan', 'camilan', 'kudapan']],
  ['vegetables', ['gado', 'pecel', 'urap', 'karedok', 'lalapan', 'lalap', 'sayur', 'tumis', 'lotek', 'trancam', 'plecing', 'pelecing', 'kangkung', 'terong', 'jantung', 'pepaya', 'daun', 'bunga', 'rebung', 'gudeg', 'oseng', 'cap cay', 'capcay', 'jengkol', 'petai', 'ketoprak', 'tauge', 'toge', 'kerabu', 'perkedel', 'bergedel', 'tahu', 'tempe', 'jamur', 'kulat']],
  ['meat-fish', ['ayam', 'bebek', 'ikan', 'udang', 'daging', 'rendang', 'babi', 'sapi', 'kambing', 'sate', 'satay', 'bakar', 'panggang', 'goreng', 'geprek', 'penyet', 'dendeng', 'empal', 'iga', 'balado', 'bandeng', 'lele', 'gurame', 'gurami', 'cumi', 'kepiting', 'kerang', 'tuna', 'cakalang', 'patin', 'belut', 'rica', 'woku', 'paniki', 'sei', 'betutu', 'lawar', 'kakap', 'tongkol', 'teri', 'asap', 'bistik', 'steak', 'rolade', 'galantin', 'sosis', 'hati', 'ati', 'ampela', 'usus', 'jeroan', 'babat', 'paru', 'otak', 'tulang', 'ceker', 'kikil', 'sumsum', 'tetelan', 'rusa', 'kerbau', 'domba', 'burung', 'puyuh', 'kodok', 'siput', 'bekicot', 'ulat', 'sagu', 'pepes', 'botok', 'tinutuan', 'kaledo', 'gohu', 'tude', 'dabu']]
];

function nameWords(name) {
  return ' ' + dishKey(name.replace(/\(.*?\)/g, ' ')) + ' ';
}

export function classifyDish(name) {
  const words = nameWords(name);
  for (const [group, keywords] of RULES) {
    if (keywords.some(keyword => words.includes(' ' + keyword + ' '))) return group;
  }
  return 'other';
}

/** Words that mark an article as being about food or drink; checked against its Wikipedia description and opening text. */
const FOOD_PATTERN = /\b(?:makanan|masakan|hidangan|kuliner|kue|kudapan|jajanan|camilan|penganan|santapan|minuman|sup|soto|sambal|nasi|mi|mie|bumbu|saus|lauk|manisan|olahan|rempah|goreng|bakar|sate|ikan|ayam|daging|sayur|sayuran|buah|roti|bubur|makan|dimakan|dihidangkan|disajikan|dimasak|memasak|resep|gulai|kari|bakso|kerupuk|keripik|tepung|beras|ketan|santan|pedas|manis|gurih|tahu|tempe|telur|udang|kepiting|cumi|sapi|kambing|babi|bebek|kopi|teh|jamu|sirup|dodol|dadih|asinan|rujak|pempek|tumpeng|kecap|terasi|petis|kelapa|pisang|singkong|ubi|sagu|jagung|kacang|nangka|durian|salak|manggis|rambutan|cokelat|coklat|madu|gula|garam|cabai|cabe)\b/i;

/**
 * The Wikipedia list scrape also catches headings and navigation entries (islands, religions, regions). An entry with an
 * article whose description and opening text never mention food is dropped, unless a recipe was found for it. Entries without
 * an article, or without a fetched summary, are kept.
 */
export function isLikelyDish({ description = '', summary = '', hasRecipe = false, hasArticle = false }) {
  if (hasRecipe) return true;
  if (!hasArticle) return true;
  if (!description && !summary) return true;
  return FOOD_PATTERN.test(description + ' ' + summary.slice(0, 260));
}
