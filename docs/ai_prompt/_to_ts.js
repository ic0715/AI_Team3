// strength_blocks.json + web/lib/constants/strengths.ts 이름 매칭 → web/lib/constants/strength_blocks.ts 생성
const fs = require('node:fs');
const path = require('node:path');

const blocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'strength_blocks.json'), 'utf8'));

// strengths.ts의 (id, name_ko, name_en) 추출 — 정규식
const strengthsSrc = fs.readFileSync(
  path.join(__dirname, '../../web/lib/constants/strengths.ts'),
  'utf8',
);
const strengthRe = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)"/g;
const slugByEn = {};
const slugByKo = {};
let m;
while ((m = strengthRe.exec(strengthsSrc)) !== null) {
  const [, id, ko, en] = m;
  slugByEn[en.toUpperCase()] = id;
  slugByKo[ko] = id;
}

// 매핑 시도
const out = {};
const unmatched = [];
for (const b of blocks) {
  const slug = slugByEn[b.name_en.toUpperCase()] ?? slugByKo[b.name_ko];
  if (slug) {
    out[slug] = b.bullets;
  } else {
    unmatched.push(`${b.name_ko}(${b.name_en})`);
  }
}

console.log('Mapped:', Object.keys(out).length, '/ 34');
if (unmatched.length) console.log('Unmatched:', unmatched);

// TS 파일로 출력
const tsContent = `// 자동 생성됨. docs/ai_prompt/_to_ts.js 통해 docx → JSON → TS 변환.
// 원본: docs/ai_prompt/강점코칭_테마별 실행항목.docx
// 갤럽 CliftonStrengths 34테마 각각의 실행 가이드 bullet 모음.
// Phase 2 액션 아이템 AI 개인화 시 사용자 Top 5 강점의 bullets를 LLM 컨텍스트로 주입.

export const STRENGTH_BLOCKS: Record<string, string[]> = ${JSON.stringify(out, null, 2)};
`;

fs.writeFileSync(
  path.join(__dirname, '../../web/lib/constants/strength_blocks.ts'),
  tsContent,
  'utf8',
);
console.log('Written:', '../../web/lib/constants/strength_blocks.ts');
