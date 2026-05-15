// docs/ai_prompt/_doc2_text.txt 파싱 → strength_pairs.json
// 구조: chapter (Top5의 하나) → partner → sentence
//        예: pairs["ACHIEVER"]["ANALYTICAL"] = "내 머리는..."

const fs = require('node:fs');
const path = require('node:path');

const raw = fs.readFileSync(path.join(__dirname, '_doc2_text.txt'), 'utf8');
const lines = raw.split(/\r?\n/);

// 챕터 헤더: 【PDF p.N】 {koname}({EnName})® 테마 (선택: 계속)
const chapterRe = /【PDF p\.\d+】\s*([^(]+?)\(([^)]+)\)[®™]?\s*테마/;

// 페어 줄: + {koname}({EnName}) 테마: {sentence}
const pairRe = /^\+\s*([^(]+?)\(([^)]+)\)\s*테마\s*[:：]\s*(.+)$/;

// 결과 구조: { CHAPTER_EN: { PARTNER_EN: sentence } }
const pairs = {};
let currentChapter = null;

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  const c = line.match(chapterRe);
  if (c) {
    const koname = c[1].trim();
    const enname = c[2].trim().toUpperCase().replace(/\s+/g, '-');
    currentChapter = enname;
    if (!pairs[currentChapter]) pairs[currentChapter] = { _ko: koname };
    continue;
  }

  if (!currentChapter) continue;

  const p = line.match(pairRe);
  if (p) {
    const partnerKo = p[1].trim();
    const partnerEn = p[2].trim().toUpperCase().replace(/\s+/g, '-');
    const sentence = p[3].trim();
    // 같은 페어가 (계속) 페이지에 또 등장하지 않음 — 첫 등장만 저장
    if (!pairs[currentChapter][partnerEn]) {
      pairs[currentChapter][partnerEn] = sentence;
    }
  } else if (pairs[currentChapter]) {
    // 페어 줄이 줄바꿈 됐을 가능성: 마지막 등록된 partner의 문장에 이어붙임
    const partners = Object.keys(pairs[currentChapter]).filter((k) => k !== '_ko');
    const lastPartner = partners[partners.length - 1];
    if (lastPartner && pairs[currentChapter][lastPartner]) {
      pairs[currentChapter][lastPartner] += ' ' + line;
    }
  }
}

// 통계
const chapters = Object.keys(pairs);
console.log('Chapters:', chapters.length);
let totalPairs = 0;
for (const c of chapters) {
  const partners = Object.keys(pairs[c]).filter((k) => k !== '_ko');
  totalPairs += partners.length;
}
console.log('Total pair entries:', totalPairs);
console.log('Expected: 34 × 33 = 1122');

// 샘플
console.log('\nSample (ACHIEVER → first 3 partners):');
const aPartners = Object.keys(pairs['ACHIEVER'] ?? {}).filter((k) => k !== '_ko').slice(0, 3);
for (const p of aPartners) {
  console.log(`  → ${p}: ${pairs['ACHIEVER'][p].slice(0, 60)}...`);
}

// JSON 저장
fs.writeFileSync(
  path.join(__dirname, 'strength_pairs.json'),
  JSON.stringify(pairs, null, 2),
  'utf8',
);
console.log('\nWritten: strength_pairs.json');
