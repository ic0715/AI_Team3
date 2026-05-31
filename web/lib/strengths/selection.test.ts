import { describe, expect, it } from 'vitest';
import type { Strength } from '@/lib/constants/strengths';
import {
  buildStrengthsPayload,
  isValidSelectedStrength,
  MAX_STRENGTHS,
  parseStoredStrengths,
  type SelectedStrength,
  toggleStrength,
} from './selection';

// 테스트 픽스처 ────────────────────────────────────────────────
const achiever: Strength = { id: 'achiever', name: '성취', nameEn: 'Achiever', domain: 'executing' };
const woo: Strength = { id: 'woo', name: '사교성', nameEn: 'Woo', domain: 'influencing' };
const empathy: Strength = { id: 'empathy', name: '공감', nameEn: 'Empathy', domain: 'relationship' };
const analytical: Strength = { id: 'analytical', name: '분석', nameEn: 'Analytical', domain: 'strategic' };
const focus: Strength = { id: 'focus', name: '집중', nameEn: 'Focus', domain: 'executing' };
const learner: Strength = { id: 'learner', name: '배움', nameEn: 'Learner', domain: 'strategic' };

const sel = (s: Strength): SelectedStrength => ({
  id: s.id,
  name: s.name,
  nameEn: s.nameEn,
  domain: s.domain,
});

const five: SelectedStrength[] = [achiever, woo, empathy, analytical, focus].map(sel);

const wrap = (userId: string, strengths: unknown) =>
  JSON.stringify({ userId, strengths });

// ─────────────────────────────────────────────────────────────
// isValidSelectedStrength
// ─────────────────────────────────────────────────────────────
describe('isValidSelectedStrength', () => {
  it('정상 객체 → true', () => {
    expect(isValidSelectedStrength(sel(achiever))).toBe(true);
  });

  it('null/원시값/배열 → false', () => {
    expect(isValidSelectedStrength(null)).toBe(false);
    expect(isValidSelectedStrength(undefined)).toBe(false);
    expect(isValidSelectedStrength('achiever')).toBe(false);
    expect(isValidSelectedStrength(42)).toBe(false);
  });

  it('필드 누락/타입 불일치 → false', () => {
    expect(isValidSelectedStrength({ id: 'x', name: '성취', nameEn: 'A' })).toBe(false); // domain 누락
    expect(isValidSelectedStrength({ id: 1, name: '성취', nameEn: 'A', domain: 'executing' })).toBe(false); // id 숫자
  });

  it('domain이 4개 유효값이 아니면 false', () => {
    expect(isValidSelectedStrength({ id: 'x', name: 'n', nameEn: 'N', domain: 'bogus' })).toBe(false);
    expect(isValidSelectedStrength({ id: 'x', name: 'n', nameEn: 'N', domain: 'T' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// parseStoredStrengths — 복원 가드
// ─────────────────────────────────────────────────────────────
describe('parseStoredStrengths', () => {
  describe('복원 불가 → null', () => {
    it('null/빈 문자열', () => {
      expect(parseStoredStrengths(null, 'u1')).toBeNull();
      expect(parseStoredStrengths(undefined, 'u1')).toBeNull();
      expect(parseStoredStrengths('', 'u1')).toBeNull();
    });

    it('JSON 파싱 실패', () => {
      expect(parseStoredStrengths('{not json', 'u1')).toBeNull();
    });

    it('비객체(숫자/배열/문자열 JSON)', () => {
      expect(parseStoredStrengths('42', 'u1')).toBeNull();
      expect(parseStoredStrengths('"hi"', 'u1')).toBeNull();
      expect(parseStoredStrengths('[1,2,3]', 'u1')).toBeNull(); // 배열엔 userId 없음 → 불일치
    });

    it('다른 계정 데이터 (userId 불일치)', () => {
      expect(parseStoredStrengths(wrap('other-user', [sel(achiever)]), 'u1')).toBeNull();
    });

    it('strengths가 배열이 아님', () => {
      expect(parseStoredStrengths(wrap('u1', 'nope'), 'u1')).toBeNull();
      expect(parseStoredStrengths(wrap('u1', null), 'u1')).toBeNull();
    });

    it('5개 초과', () => {
      const six = [achiever, woo, empathy, analytical, focus, learner].map(sel);
      expect(parseStoredStrengths(wrap('u1', six), 'u1')).toBeNull();
    });

    it('손상된 원소 포함 (하드닝 — 크래시 방어)', () => {
      // domain 누락된 원소가 섞이면 전체 복원 포기
      const broken = [sel(achiever), { id: 'x', name: 'n', nameEn: 'N' }];
      expect(parseStoredStrengths(wrap('u1', broken), 'u1')).toBeNull();
      // domain 값이 유효 union이 아님
      const badDomain = [{ id: 'x', name: 'n', nameEn: 'N', domain: 'invalid' }];
      expect(parseStoredStrengths(wrap('u1', badDomain), 'u1')).toBeNull();
    });
  });

  describe('정상 복원', () => {
    it('유효한 1~5개 배열 → 그대로 (순서 보존)', () => {
      const restored = parseStoredStrengths(wrap('u1', [sel(achiever), sel(woo)]), 'u1');
      expect(restored).toEqual([sel(achiever), sel(woo)]);
    });

    it('정확히 5개(경계) → 복원', () => {
      expect(parseStoredStrengths(wrap('u1', five), 'u1')).toHaveLength(5);
    });

    it('빈 배열(0개) → 빈 배열 복원', () => {
      expect(parseStoredStrengths(wrap('u1', []), 'u1')).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// toggleStrength — 5개 상한 토글
// ─────────────────────────────────────────────────────────────
describe('toggleStrength', () => {
  it('미선택 강점 추가', () => {
    const next = toggleStrength([], achiever);
    expect(next).toEqual([sel(achiever)]);
  });

  it('이미 선택된 강점 해제', () => {
    const next = toggleStrength([sel(achiever), sel(woo)], achiever);
    expect(next).toEqual([sel(woo)]);
  });

  it('추가는 배열 끝에 append (순서 보존)', () => {
    const next = toggleStrength([sel(achiever)], woo);
    expect(next.map((s) => s.id)).toEqual(['achiever', 'woo']);
  });

  it('5개 도달 시 새 강점 추가 무시 + 동일 참조 반환', () => {
    const next = toggleStrength(five, learner);
    expect(next).toBe(five); // 동일 참조 → 호출부가 저장 스킵 판단
    expect(next).toHaveLength(MAX_STRENGTHS);
  });

  it('5개여도 이미 선택된 강점 해제는 동작', () => {
    const next = toggleStrength(five, achiever);
    expect(next).toHaveLength(4);
    expect(next.some((s) => s.id === 'achiever')).toBe(false);
  });

  it('Strength의 추가 필드는 페이로드에 포함하지 않고 4개 필드만 보관', () => {
    const next = toggleStrength([], achiever);
    expect(Object.keys(next[0]).sort()).toEqual(['domain', 'id', 'name', 'nameEn']);
  });

  it('원본 배열 불변 (해제/추가 모두 새 배열)', () => {
    const prev = [sel(achiever)];
    toggleStrength(prev, woo);
    toggleStrength(prev, achiever);
    expect(prev).toEqual([sel(achiever)]); // 변형 없음
  });
});

// ─────────────────────────────────────────────────────────────
// buildStrengthsPayload — DB 페이로드 (1-based rank)
// ─────────────────────────────────────────────────────────────
describe('buildStrengthsPayload', () => {
  it('선택 순서대로 1-based rank 부여 + 필드 매핑', () => {
    const payload = buildStrengthsPayload([sel(achiever), sel(woo), sel(empathy)]);
    expect(payload).toEqual([
      { rank: 1, name_ko: '성취', name_en: 'Achiever', domain: 'executing' },
      { rank: 2, name_ko: '사교성', name_en: 'Woo', domain: 'influencing' },
      { rank: 3, name_ko: '공감', name_en: 'Empathy', domain: 'relationship' },
    ]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(buildStrengthsPayload([])).toEqual([]);
  });

  it('rank는 1부터 연속 증가', () => {
    const payload = buildStrengthsPayload(five);
    expect(payload.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('id는 페이로드에 포함되지 않음 (DB 계약은 name/domain/rank)', () => {
    const payload = buildStrengthsPayload([sel(achiever)]);
    expect(Object.keys(payload[0]).sort()).toEqual(['domain', 'name_en', 'name_ko', 'rank']);
  });
});
