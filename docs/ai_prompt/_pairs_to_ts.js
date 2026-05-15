// strength_pairs.json + strengths.ts → web/lib/constants/strength_pairs.ts
const fs = require('node:fs');
const path = require('node:path');

const pairsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'strength_pairs.json'), 'utf8'));

// strengths.ts에서 nameEn(대문자화) → slug(id) 매핑 추출
const strengthsSrc = fs.readFileSync(
  path.join(__dirname, '../../web/lib/constants/strengths.ts'),
  'utf8',
);
const strengthRe = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)"/g;
const slugByEn = {};
const koByEn = {};
let m;
while ((m = strengthRe.exec(strengthsSrc)) !== null) {
  const [, id, ko, en] = m;
  const enKey = en.toUpperCase();
  slugByEn[enKey] = id;
  koByEn[enKey] = ko;
}

// strength_pairs.json의 키들을 slug 기반으로 재매핑
// pairsRaw[chapterEn][partnerEn] = sentence  →  out[chapterSlug][partnerSlug] = sentence
const out = {};
let unmatched = new Set();
for (const chEn of Object.keys(pairsRaw)) {
  const chSlug = slugByEn[chEn];
  if (!chSlug) { unmatched.add(chEn); continue; }
  out[chSlug] = {};
  const entries = pairsRaw[chEn];
  for (const partEn of Object.keys(entries)) {
    if (partEn === '_ko') continue;
    const partSlug = slugByEn[partEn];
    if (!partSlug) { unmatched.add(partEn); continue; }
    out[chSlug][partSlug] = entries[partEn];
  }
}

console.log('Chapters in TS:', Object.keys(out).length);
console.log('Unmatched names:', [...unmatched]);

const tsContent = `// 자동 생성됨. docs/ai_prompt/_pairs_to_ts.js 통해 docx → JSON → TS 변환.
// 원본: docs/ai_prompt/강점코칭_테마별 조합.docx (1,088 페어 문장, 양방향)
// 구조: STRENGTH_PAIRS[chapterId][partnerId] = "1인칭 페어 시너지/긴장 문장"
// 사용: 인터뷰 시점 사용자 Top 5 → C(5,2)=10페어 → 양방향 2문장 = 20문장 필터링하여 시스템 프롬프트에 주입.

export const STRENGTH_PAIRS: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 2)};

/**
 * 사용자 Top 5 강점의 slug 배열을 받아, C(5,2) = 10페어 × 양방향 2문장 = 20문장의 컨텍스트 블록을 생성.
 * 일부 페어가 누락된 경우(예: responsibility 챕터 없음) 가능한 것만 반환.
 */
export function buildPairContextBlock(topStrengthIds: string[]): string {
  const ids = topStrengthIds.slice(0, 5);
  const lines: string[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const fromA = STRENGTH_PAIRS[a]?.[b];
      const fromB = STRENGTH_PAIRS[b]?.[a];
      if (!fromA && !fromB) continue;
      lines.push(\`[\${a} × \${b}]\`);
      if (fromA) lines.push(\`  - (\${a} 관점) \${fromA}\`);
      if (fromB) lines.push(\`  - (\${b} 관점) \${fromB}\`);
    }
  }

  return lines.join('\\n');
}
`;

fs.writeFileSync(
  path.join(__dirname, '../../web/lib/constants/strength_pairs.ts'),
  tsContent,
  'utf8',
);
console.log('Written: web/lib/constants/strength_pairs.ts');
