# One-off: adds the second batch of species message keys (detail popup and share card). Run once from the repository root.
import json
KEYS = ['species_share_heading','species_share_caveat','species_photo_of','species_open_details','species_also_known','species_no_description','species_sources','species_all_rights_reserved']
T = {
'en': ['Share this species','Photo, status and description come from public biodiversity sources and may be out of date or incomplete.','Photo {current} of {total}','Open details for {name}','Also known as','No description available.','Sources','all rights reserved'],
'id': ['Bagikan spesies ini','Foto, status, dan deskripsi berasal dari sumber keanekaragaman hayati publik dan bisa saja usang atau belum lengkap.','Foto {current} dari {total}','Buka detail {name}','Juga dikenal sebagai','Deskripsi belum tersedia.','Sumber','hak cipta dilindungi'],
'ms': ['Kongsi spesies ini','Foto, status dan keterangan datang daripada sumber biodiversiti awam dan mungkin sudah lapuk atau tidak lengkap.','Foto {current} daripada {total}','Buka butiran {name}','Juga dikenali sebagai','Tiada keterangan.','Sumber','hak cipta terpelihara'],
'fil': ['Ibahagi ang species na ito','Ang larawan, katayuan at paglalarawan ay galing sa mga pampublikong pinagmulan ng biodiversity at maaaring luma o kulang.','Larawan {current} ng {total}','Buksan ang detalye ng {name}','Kilala rin bilang','Walang paglalarawan.','Mga pinagmulan','all rights reserved'],
'vi': ['Chia sẻ loài này','Ảnh, tình trạng và mô tả lấy từ các nguồn đa dạng sinh học công khai và có thể đã cũ hoặc chưa đầy đủ.','Ảnh {current} / {total}','Mở chi tiết {name}','Còn gọi là','Chưa có mô tả.','Nguồn','bảo lưu mọi quyền'],
'th': ['แชร์ชนิดพันธุ์นี้','รูปภาพ สถานะ และคำอธิบายมาจากแหล่งข้อมูลความหลากหลายทางชีวภาพสาธารณะ และอาจล้าสมัยหรือไม่ครบถ้วน','รูปที่ {current} จาก {total}','เปิดรายละเอียดของ {name}','เป็นที่รู้จักในชื่อ','ไม่มีคำอธิบาย','แหล่งข้อมูล','สงวนลิขสิทธิ์'],
'zh-SG': ['分享这个物种','照片、状态和简介来自公开的生物多样性资料，可能已过时或不完整。','第 {current} 张，共 {total} 张','打开{name}的详情','又名','暂无简介。','来源','保留所有权利'],
'pt-TL': ['Partilhar esta espécie','A foto, o estado e a descrição vêm de fontes públicas de biodiversidade e podem estar desatualizados ou incompletos.','Foto {current} de {total}','Abrir detalhes de {name}','Também conhecida como','Sem descrição.','Fontes','todos os direitos reservados'],
'tet': ['Fahe espésie ne’e','Foto, estadu no deskrisaun mai husi fonte públiku kona-ba biodiversidade no bele antigu ka la kompletu.','Foto {current} husi {total}','Loke detallu {name}','Mós hatene ho naran','La iha deskrisaun.','Fonte sira','direitu hotu reservadu'],
'km': ['ចែករំលែកប្រភេទនេះ','រូបថត ស្ថានភាព និងការពិពណ៌នា មកពីប្រភពជីវចម្រុះសាធារណៈ ហើយអាចហួសសម័យ ឬមិនពេញលេញ។','រូបទី {current} ក្នុងចំណោម {total}','បើកព័ត៌មានលម្អិតរបស់ {name}','ត្រូវបានស្គាល់ផងដែរថា','មិនមានការពិពណ៌នា។','ប្រភព','រក្សាសិទ្ធិគ្រប់យ៉ាង'],
'lo': ['ແບ່ງປັນຊະນິດນີ້','ຮູບ, ສະຖານະ ແລະ ລາຍລະອຽດມາຈາກແຫຼ່ງຂໍ້ມູນຊີວະນາໆພັນສາທາລະນະ ແລະ ອາດລ້າສະໄໝ ຫຼື ບໍ່ຄົບຖ້ວນ.','ຮູບທີ {current} ຈາກ {total}','ເປີດລາຍລະອຽດຂອງ {name}','ເປັນທີ່ຮູ້ຈັກອີກຊື່','ບໍ່ມີລາຍລະອຽດ.','ແຫຼ່ງຂໍ້ມູນ','ສະຫງວນລິຂະສິດ'],
'my': ['ဤမျိုးစိတ်ကို မျှဝေရန်','ဓာတ်ပုံ၊ အခြေအနေနှင့် ဖော်ပြချက်များသည် အများပြည်သူသုံး ဇီဝမျိုးကွဲရင်းမြစ်များမှ ဖြစ်ပြီး ခေတ်နောက်ကျနိုင် သို့မဟုတ် မပြည့်စုံနိုင်ပါ။','ဓာတ်ပုံ {total} ပုံအနက် {current} ပုံ','{name} အသေးစိတ်ကို ဖွင့်ရန်','အခြားအမည်','ဖော်ပြချက် မရှိပါ။','ရင်းမြစ်များ','မူပိုင်ခွင့်ရှိသည်'],
'ta': ['இந்த இனத்தைப் பகிரவும்','புகைப்படம், நிலை மற்றும் விளக்கம் பொது பல்லுயிர் மூலங்களிலிருந்து வருகின்றன; அவை பழையதாகவோ முழுமையற்றதாகவோ இருக்கலாம்.','புகைப்படம் {current} / {total}','{name} விவரங்களைத் திற','மற்றொரு பெயர்','விளக்கம் இல்லை.','மூலங்கள்','அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை'],
}
for locale, values in T.items():
    assert len(values) == len(KEYS), locale
    path = 'messages/' + locale + '.json'
    data = json.load(open(path))
    for key, value in zip(KEYS, values):
        data[key] = value
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    open(path, 'a').write('\n')
print('updated', len(T), 'locales')
