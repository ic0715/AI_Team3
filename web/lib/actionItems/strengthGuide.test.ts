import { describe, it, expect } from 'vitest';
import { resolveStrengthBlocks } from './strengthGuide';
import { buildStrengthsPayload } from '@/lib/strengths/selection';

describe('resolveStrengthBlocks', () => {
  // 회귀: 실제 저장 형상은 id가 없다(name_ko/name_en만). 과거엔 STRENGTH_BLOCKS[s.id] 미스로 빈 결과였음.
  it('id 없는 저장 형상(name_ko)으로도 블록을 해소한다', () => {
    const persisted = [
      { rank: 1, name_ko: '분석', name_en: 'Analytical', domain: 'strategic' },
      { rank: 2, name_ko: '전략', name_en: 'Strategic', domain: 'strategic' },
    ];
    const blocks = resolveStrengthBlocks(persisted);
    expect(Object.keys(blocks)).toEqual(['분석', '전략']); // 한글명으로 키잉
    expect(blocks['분석'].length).toBeGreaterThan(0); // 비어있지 않음(가이드 실제 주입됨)
  });

  it('buildStrengthsPayload 출력(실제 DB 페이로드)을 그대로 먹여도 비어있지 않다', () => {
    // 드리프트를 끝단까지 재현: 저장 헬퍼 출력 → 리졸버.
    const payload = buildStrengthsPayload([
      { id: 'analytical', name: '분석', nameEn: 'Analytical', domain: 'strategic' },
      { id: 'focus', name: '집중', nameEn: 'Focus', domain: 'executing' },
    ]);
    // payload에는 id가 없음을 먼저 확인(계약 고정)
    expect(payload[0]).not.toHaveProperty('id');
    const blocks = resolveStrengthBlocks(payload);
    expect(Object.keys(blocks).length).toBe(2);
    for (const k of Object.keys(blocks)) expect(blocks[k].length).toBeGreaterThan(0);
  });

  it('영문명(대소문자 무관)으로도 해소된다', () => {
    const blocks = resolveStrengthBlocks([{ name_en: 'Analytical' }]);
    // name_ko가 없으면 키를 만들 수 없으므로(라벨용) 제외 — name_ko 필요
    expect(Object.keys(blocks)).toEqual([]);
    const withKo = resolveStrengthBlocks([{ name_ko: '분석', name_en: 'ANALYTICAL' as string }]);
    expect(withKo['분석'].length).toBeGreaterThan(0);
  });

  it('알 수 없는 강점은 조용히 제외', () => {
    const blocks = resolveStrengthBlocks([{ name_ko: '존재하지않는강점', name_en: 'Nope' }]);
    expect(blocks).toEqual({});
  });

  it('id가 유효하게 들어오는 경로도 지원(방어적)', () => {
    const blocks = resolveStrengthBlocks([{ id: 'analytical', name_ko: '분석' }]);
    expect(blocks['분석'].length).toBeGreaterThan(0);
  });
});
