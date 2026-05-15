const fs = require('node:fs');
const path = require('node:path');

const raw = fs.readFileSync(path.join(__dirname, '_doc1_text.txt'), 'utf8');
const lines = raw.split(/\r?\n/);

// 패턴: "N)테마이름(THEME_EN) 테마가 지배적인 사람의 실행 항목"
const headerRe = /^(\d+)\)\s*([^\(]+?)\(([A-Z\- ]+)\)\s*테마가/;

const themes = [];
let current = null;

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;
  const m = line.match(headerRe);
  if (m) {
    if (current) themes.push(current);
    current = {
      index: parseInt(m[1], 10),
      name_ko: m[2].trim(),
      name_en: m[3],
      bullets: [],
    };
    continue;
  }
  if (!current) continue;
  // 첫 글자가 • 또는 . 이면 새 bullet, 아니면 이전 bullet에 이어붙임
  if (line.startsWith('•') || line.startsWith('.')) {
    current.bullets.push(line.replace(/^[•.]\s*/, '').trim());
  } else {
    // 머리없는 줄: 이전 bullet 연결
    if (current.bullets.length === 0) {
      current.bullets.push(line);
    } else {
      current.bullets[current.bullets.length - 1] += ' ' + line;
    }
  }
}
if (current) themes.push(current);

// 영문 키 정규화 (constants/strengths.ts와 매칭)
fs.writeFileSync(
  path.join(__dirname, 'strength_blocks.json'),
  JSON.stringify(themes, null, 2),
  'utf8',
);

console.log('Themes:', themes.length);
console.log('Sample (first):', JSON.stringify(themes[0], null, 2).slice(0, 400));
console.log('Bullet counts:', themes.map(t => `${t.name_en}=${t.bullets.length}`).join(', '));
