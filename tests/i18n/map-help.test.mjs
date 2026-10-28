import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const requirements = [
  { locale: 'en', doubleTap: /double-tap/i, rotate: /twist two fingers/i, tilt: /vertically together/i, keyboard: /keyboard/i },
  { locale: 'id', doubleTap: /ketuk dua kali/i, rotate: /putar dua jari/i, tilt: /bersamaan ke atas\/bawah/i, keyboard: /papan ketik/i },
  { locale: 'ms', doubleTap: /ketik dua kali/i, rotate: /putarkan dua jari/i, tilt: /atas\/bawah serentak/i, keyboard: /papan kekunci/i },
  { locale: 'fil', doubleTap: /i-double-tap/i, rotate: /paikutin ang dalawang daliri/i, tilt: /sabay na igalaw/i, keyboard: /keyboard/i },
  { locale: 'th', doubleTap: /แตะสองครั้ง/, rotate: /หมุนสองนิ้ว/, tilt: /สองนิ้วขึ้นหรือลงพร้อมกัน/, keyboard: /แป้นพิมพ์/ },
  { locale: 'vi', doubleTap: /chạm hai lần/i, rotate: /xoay hai ngón tay/i, tilt: /lên\/xuống cùng lúc/i, keyboard: /bàn phím/i },
  { locale: 'my', doubleTap: /နှစ်ချက်ထိ/, rotate: /လက်နှစ်ချောင်းကို လှည့်/, tilt: /တစ်ပြိုင်နက်ရွှေ့/, keyboard: /ကီးဘုတ်/ },
  { locale: 'km', doubleTap: /ប៉ះពីរដង/, rotate: /បង្វិលម្រាមដៃពីរ/, tilt: /ឡើង\/ចុះព្រមគ្នា/, keyboard: /ក្តារចុច/ },
  { locale: 'lo', doubleTap: /ແຕະສອງຄັ້ງ/, rotate: /ໝຸນສອງນິ້ວ/, tilt: /ຂຶ້ນ\/ລົງພ້ອມກັນ/, keyboard: /ແປ້ນພິມ/ },
  { locale: 'zh-SG', doubleTap: /轻点两下/, rotate: /双指转动/, tilt: /双指同时上下滑动/, keyboard: /键盘/ },
  { locale: 'ta', doubleTap: /இருமுறை தட்ட/, rotate: /இரு விரல்களைச் சுழற்ற/, tilt: /ஒன்றாக மேலே\/கீழே/, keyboard: /விசைப்பலகை/ },
  { locale: 'tet', doubleTap: /toka dala rua/i, rotate: /dulas liman-fuan rua/i, tilt: /hamutuk ba leten\/kraik/i, keyboard: /tekladu/i },
  { locale: 'pt-TL', doubleTap: /toque duas vezes/i, rotate: /rode dois dedos/i, tilt: /cima\/baixo em simultâneo/i, keyboard: /teclado/i }
];
const english = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));

for (const requirement of requirements) {
  test(`${requirement.locale} has localized 2D and 3D help for the supported gestures`, () => {
    const messages = JSON.parse(readFileSync(new URL(`../../messages/${requirement.locale}.json`, import.meta.url), 'utf8'));
    const flat = messages.map_help;
    const scene = messages.map_help_3d;
    let localized = true;
    if (requirement.locale !== 'en') localized = flat !== english.map_help && scene !== english.map_help_3d;
    assert.deepEqual({
      has2D: typeof flat === 'string' && flat.length > 0,
      has3D: typeof scene === 'string' && scene.length > 0,
      doubleTap2D: requirement.doubleTap.test(flat),
      doubleTap3D: requirement.doubleTap.test(scene),
      separateRotation: requirement.rotate.test(scene),
      separateTilt: requirement.tilt.test(scene),
      keyboardAlternative: requirement.keyboard.test(flat),
      localized
    }, { has2D: true, has3D: true, doubleTap2D: true, doubleTap3D: true, separateRotation: true, separateTilt: true, keyboardAlternative: true, localized: true });
  });
}
