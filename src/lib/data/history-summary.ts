import type { HistoricalPolity } from './history';
import { getLocale } from '$lib/paraglide/runtime.js';

/**
 * Source-specific editorial copy is maintained in id/en. Other locales receive
 * a brief translated *metadata overview* rather than an unreviewed machine
 * translation of nuanced claims. Never present it as a complete translation
 * of the historical research note.
 */
type Template = (p: HistoricalPolity, rulers: string) => string;
const localized: Record<string, Template> = {
  ms: (p,r) => `${p.name} merupakan kerajaan atau pemerintahan bersejarah yang dikaitkan dengan ${p.place}, sekitar ${p.from}–${p.to} M. Tokoh pemerintah yang direkodkan: ${r}. Had wilayah dan kronologi masih anggaran; rujuk sumber sejarah.`,
  fil: (p,r) => `Ang ${p.name} ay isang makasaysayang kaharian o pamahalaan sa rehiyong ${p.place}, humigit-kumulang ${p.from}–${p.to} CE. Mga kinikilalang pinuno: ${r}. Tinataya lamang ang mga petsa at impluwensiya; tingnan ang mga sanggunian.`,
  th: (p,r) => `${p.name} เป็นอาณาจักรหรือศูนย์กลางการปกครองในประวัติศาสตร์ที่เกี่ยวข้องกับ ${p.place} ราว ค.ศ. ${p.from}–${p.to} ผู้ปกครองที่มีบันทึก: ${r} ช่วงเวลาและอิทธิพลเป็นเพียงการประมาณ โปรดตรวจสอบเอกสารอ้างอิง`,
  vi: (p,r) => `${p.name} là một vương quốc hoặc chính quyền lịch sử gắn với ${p.place}, khoảng năm ${p.from}–${p.to} CN. Những người cai trị được ghi nhận: ${r}. Niên đại và phạm vi ảnh hưởng chỉ mang tính ước lượng; xem các nguồn trích dẫn.`,
  my: (p,r) => `${p.name} သည် ${p.place} ဒေသနှင့် ဆက်စပ်သော သမိုင်းဝင်နိုင်ငံ သို့မဟုတ် အုပ်ချုပ်ရေးဖြစ်ပြီး ခန့်မှန်းအားဖြင့် ခရစ်နှစ် ${p.from}–${p.to} တွင် တည်ရှိခဲ့သည်။ မှတ်တမ်းတင်ထားသော အုပ်ချုပ်သူများမှာ ${r} ဖြစ်သည်။ အချိန်နှင့် သြဇာနယ်ပယ်မှာ ခန့်မှန်းချက်ဖြစ်သဖြင့် ရင်းမြစ်များကို စစ်ဆေးပါ။`,
  km: (p,r) => `${p.name} គឺជានគរ ឬរដ្ឋបាលប្រវត្តិសាស្ត្រដែលពាក់ព័ន្ធនឹង ${p.place} ប្រហែលឆ្នាំ ${p.from}–${p.to} គ.ស.។ អ្នកគ្រប់គ្រងដែលមានកំណត់ត្រា៖ ${r}។ កាលបរិច្ឆេទ និងឥទ្ធិពលគឺជាការប៉ាន់ស្មាន សូមពិនិត្យប្រភពឯកសារ។`,
  lo: (p,r) => `${p.name} ເປັນອານາຈັກ ຫຼືການປົກຄອງທາງປະຫວັດສາດທີ່ກ່ຽວຂ້ອງກັບ ${p.place} ປະມານປີ ຄ.ສ. ${p.from}–${p.to} ຜູ້ປົກຄອງທີ່ມີບັນທຶກ: ${r} ຊ່ວງເວລາ ແລະອິດທິພົນເປັນພຽງການຄາດຄະເນ ກະລຸນາກວດແຫຼ່ງຂໍ້ມູນ`,
  'zh-SG': (p,r) => `${p.name} 是与 ${p.place} 有关的历史王国或政权，活动年代约为公元 ${p.from}–${p.to} 年。史料记载的统治者有：${r}。年代及势力范围仅属估计，请参阅所列史料。`,
  ta: (p,r) => `${p.name} என்பது ${p.place} பகுதியுடன் தொடர்புடைய வரலாற்று அரசு அல்லது ஆட்சியாகும். ஏறத்தாழ கி.பி. ${p.from}–${p.to} காலத்திற்குரியது. பதிவாகிய ஆட்சியாளர்கள்: ${r}. காலமும் செல்வாக்கும் தோராயமானவை; ஆதாரங்களைப் பாருங்கள்.`,
  tet: (p,r) => `${p.name} mak reinu ka governu istóriku ne'ebé relasiona ho ${p.place}, maizumenus iha tinan ${p.from}–${p.to} CE. Governa-na'in sira ne'ebé dokumentadu: ${r}. Data no área influénsia estimasaun de'it; haree fonte sira.`,
  'pt-TL': (p,r) => `${p.name} foi um reino ou governo histórico associado a ${p.place}, aproximadamente entre ${p.from} e ${p.to} d.C. Governantes documentados: ${r}. A cronologia e a influência são aproximadas; consulte as fontes.`,
  ja: (p,r) => `${p.name} は、${p.place} に関連する歴史上の王国または政権で、およそ西暦${p.from}～${p.to}年に存在しました。史料に記録された統治者：${r}。年代や勢力圏は推定です。出典をご確認ください。`
};
const unknownRulers: Record<string,string> = {
  ms:'tidak dinyatakan',fil:'hindi nakatala',th:'ไม่ปรากฏรายชื่อ',vi:'chưa được ghi rõ',my:'မသိရ',km:'មិនមានបញ្ជាក់',lo:'ບໍ່ມີລາຍຊື່','zh-SG':'暂无明确记载',ta:'பதிவு இல்லை',tet:'la hatene','pt-TL':'não indicados',ja:'未記載'
};
export function localizedHistorySummary(p: HistoricalPolity): string {
  const locale = getLocale();
  if (locale === 'id') return p.summary.id;
  if (locale === 'en') return p.summary.en;
  const template = localized[locale];
  if (!template) return p.summary.en;
  const rulers = p.rulers.map(r => r.name).slice(0,4).join(', ') || unknownRulers[locale];
  return template(p, rulers);
}
