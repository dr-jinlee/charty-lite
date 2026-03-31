// 미용 클리닉 시술/고민 용어 즉시 번역 사전 (API 호출 없이 0ms)
// Procedure Hub taxonomy 기반

export const MEDICAL_DICT: Record<string, Record<string, string>> = {
  // ─── 시술명 ───
  '보톡스': { en: 'Botox', zh: '肉毒素', ja: 'ボトックス', vi: 'Botox' },
  '필러': { en: 'Filler', zh: '填充剂', ja: 'フィラー', vi: 'Filler' },
  '쥬비덤': { en: 'Juvéderm', zh: 'Juvéderm乔雅登', ja: 'ジュビダーム', vi: 'Juvéderm' },
  '레스틸렌': { en: 'Restylane', zh: 'Restylane瑞蓝', ja: 'レスチレン', vi: 'Restylane' },
  '울쎄라': { en: 'Ulthera', zh: '超声刀', ja: 'ウルセラ', vi: 'Ulthera' },
  '써마지': { en: 'Thermage', zh: '热玛吉', ja: 'サーマジ', vi: 'Thermage' },
  '리프팅': { en: 'Lifting', zh: '提升', ja: 'リフティング', vi: 'Nâng cơ' },
  '슈링크': { en: 'Shurink', zh: '超声提升', ja: 'シュリンク', vi: 'Shurink' },
  '실리프팅': { en: 'Thread Lift', zh: '线雕', ja: '糸リフト', vi: 'Căng chỉ' },
  '리쥬란': { en: 'Rejuran', zh: '婴儿针', ja: 'リジュラン', vi: 'Rejuran' },
  '쥬베룩': { en: 'Juvelook', zh: 'Juvelook', ja: 'ジュベルック', vi: 'Juvelook' },
  '물광주사': { en: 'Skin Booster', zh: '水光针', ja: '水光注射', vi: 'Tiêm dưỡng ẩm' },
  '스킨부스터': { en: 'Skin Booster', zh: '水光针', ja: 'スキンブースター', vi: 'Skin Booster' },
  '엑소좀': { en: 'Exosome', zh: '外泌体', ja: 'エクソソーム', vi: 'Exosome' },
  '피코토닝': { en: 'Pico Toning', zh: '皮秒调Q', ja: 'ピコトーニング', vi: 'Pico Toning' },
  '레이저토닝': { en: 'Laser Toning', zh: '激光调Q', ja: 'レーザートーニング', vi: 'Laser Toning' },
  '제네시스': { en: 'Genesis', zh: 'Genesis', ja: 'ジェネシス', vi: 'Genesis' },
  'IPL': { en: 'IPL', zh: 'IPL光子嫩肤', ja: 'IPL', vi: 'IPL' },
  '실펌': { en: 'Sylfirm', zh: 'Sylfirm', ja: 'シルファーム', vi: 'Sylfirm' },
  '포텐자': { en: 'Potenza', zh: 'Potenza', ja: 'ポテンツァ', vi: 'Potenza' },
  '인모드': { en: 'InMode', zh: 'InMode', ja: 'インモード', vi: 'InMode' },
  '제모': { en: 'Hair Removal', zh: '脱毛', ja: '脱毛', vi: 'Triệt lông' },
  '지방분해': { en: 'Fat Dissolving', zh: '溶脂', ja: '脂肪溶解', vi: 'Tiêm tan mỡ' },
  '윤곽주사': { en: 'Contouring Injection', zh: '轮廓针', ja: '輪郭注射', vi: 'Tiêm tạo đường nét' },
  '스컬트라': { en: 'Sculptra', zh: 'Sculptra童颜针', ja: 'スカルプトラ', vi: 'Sculptra' },
  '엘란쎄': { en: 'Ellansé', zh: 'Ellansé少女针', ja: 'エランセ', vi: 'Ellansé' },
  '프로파일로': { en: 'Profhilo', zh: 'Profhilo', ja: 'プロファイロ', vi: 'Profhilo' },
  '샤넬주사': { en: 'Chanel Injection', zh: '香奈儿针', ja: 'シャネル注射', vi: 'Tiêm Chanel' },
  '백옥주사': { en: 'Glutathione IV', zh: '白玉注射', ja: '白玉注射', vi: 'Truyền Glutathione' },
  'PRP': { en: 'PRP', zh: 'PRP自体血', ja: 'PRP', vi: 'PRP' },

  // ─── 부위 ───
  '팔자주름': { en: 'Nasolabial folds', zh: '法令纹', ja: 'ほうれい線', vi: 'Nếp nhăn rãnh mũi má' },
  '이마': { en: 'Forehead', zh: '额头', ja: 'おでこ', vi: 'Trán' },
  '미간': { en: 'Glabella', zh: '眉间', ja: '眉間', vi: 'Giữa lông mày' },
  '눈가': { en: 'Eye area', zh: '眼周', ja: '目元', vi: 'Vùng mắt' },
  '사각턱': { en: 'Square jaw', zh: '方下颌', ja: 'エラ', vi: 'Hàm vuông' },
  '승모근': { en: 'Trapezius', zh: '斜方肌', ja: '僧帽筋', vi: 'Cơ thang' },
  '턱끝': { en: 'Chin', zh: '下巴', ja: 'あご先', vi: 'Cằm' },
  '애교살': { en: 'Aegyo-sal', zh: '卧蚕', ja: '涙袋', vi: 'Túi mắt dưới' },
  '볼': { en: 'Cheek', zh: '脸颊', ja: '頬', vi: 'Má' },
  '입술': { en: 'Lips', zh: '嘴唇', ja: '唇', vi: 'Môi' },
  '코': { en: 'Nose', zh: '鼻子', ja: '鼻', vi: 'Mũi' },
  '턱선': { en: 'Jawline', zh: '下颌线', ja: 'フェイスライン', vi: 'Đường hàm' },
  '이중턱': { en: 'Double chin', zh: '双下巴', ja: '二重あご', vi: 'Nọng cằm' },
  '목주름': { en: 'Neck wrinkles', zh: '颈纹', ja: '首のシワ', vi: 'Nhăn cổ' },

  // ─── 고민/증상 ───
  '주름': { en: 'Wrinkles', zh: '皱纹', ja: 'シワ', vi: 'Nếp nhăn' },
  '탄력': { en: 'Elasticity', zh: '弹性', ja: '弾力', vi: 'Đàn hồi' },
  '처짐': { en: 'Sagging', zh: '下垂', ja: 'たるみ', vi: 'Chảy xệ' },
  '기미': { en: 'Melasma', zh: '黄褐斑', ja: '肝斑', vi: 'Nám' },
  '잡티': { en: 'Blemishes', zh: '色斑', ja: 'シミ', vi: 'Tàn nhang' },
  '색소': { en: 'Pigmentation', zh: '色素', ja: '色素', vi: 'Sắc tố' },
  '모공': { en: 'Pores', zh: '毛孔', ja: '毛穴', vi: 'Lỗ chân lông' },
  '여드름': { en: 'Acne', zh: '痤疮', ja: 'ニキビ', vi: 'Mụn' },
  '홍조': { en: 'Redness', zh: '潮红', ja: '赤ら顔', vi: 'Đỏ mặt' },
  '다크서클': { en: 'Dark circles', zh: '黑眼圈', ja: 'クマ', vi: 'Quầng thâm' },
  '볼륨': { en: 'Volume', zh: '饱满度', ja: 'ボリューム', vi: 'Độ đầy' },

  // ─── 상담 용어 ───
  '부작용': { en: 'Side effects', zh: '副作用', ja: '副作用', vi: 'Tác dụng phụ' },
  '알레르기': { en: 'Allergy', zh: '过敏', ja: 'アレルギー', vi: 'Dị ứng' },
  '마취': { en: 'Anesthesia', zh: '麻醉', ja: '麻酔', vi: 'Gây tê' },
  '시술': { en: 'Procedure', zh: '治疗', ja: '施術', vi: 'Thủ thuật' },
  '상담': { en: 'Consultation', zh: '咨询', ja: '相談', vi: 'Tư vấn' },
  '효과': { en: 'Effect', zh: '效果', ja: '効果', vi: 'Hiệu quả' },
  '유지기간': { en: 'Duration', zh: '维持时间', ja: '持続期間', vi: 'Thời gian duy trì' },
  '다운타임': { en: 'Downtime', zh: '恢复期', ja: 'ダウンタイム', vi: 'Thời gian nghỉ' },
  '멍': { en: 'Bruising', zh: '淤青', ja: '内出血', vi: 'Bầm tím' },
  '붓기': { en: 'Swelling', zh: '肿胀', ja: '腫れ', vi: 'Sưng' },
  '통증': { en: 'Pain', zh: '疼痛', ja: '痛み', vi: 'Đau' },
  '켈로이드': { en: 'Keloid', zh: '疤痕疙瘩', ja: 'ケロイド', vi: 'Sẹo lồi' },
};

// 텍스트에서 사전 매칭된 용어를 하이라이트 번역
export function instantTranslate(text: string, lang: string): string | null {
  const terms: string[] = [];
  // 긴 키부터 매칭 (예: "팔자주름"이 "주름"보다 먼저)
  const sortedKeys = Object.keys(MEDICAL_DICT).sort((a, b) => b.length - a.length);
  let remaining = text;
  const parts: string[] = [];

  for (const key of sortedKeys) {
    if (remaining.includes(key)) {
      const dict = MEDICAL_DICT[key];
      if (dict[lang]) {
        terms.push(`${key}(${dict[lang]})`);
      }
    }
  }

  if (terms.length === 0) return null;

  // 원문에 괄호로 번역 삽입
  let result = text;
  for (const key of sortedKeys) {
    const dict = MEDICAL_DICT[key];
    if (dict[lang] && result.includes(key)) {
      result = result.replaceAll(key, `${key}(${dict[lang]})`);
    }
  }
  return result;
}
