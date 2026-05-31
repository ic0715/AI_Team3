import { describe, expect, it } from 'vitest';
import {
  buildProfileUpdate,
  canSaveProfile,
  careerLabel,
  CAREER_OPTIONS,
  displayStrengths,
  isValidStrengthItem,
  mapProfileRow,
  normalizeStrengths,
  STRENGTHS_DISPLAY_MAX,
  type StrengthItem,
} from './myProfile';

const strength = (over: Partial<StrengthItem> = {}): StrengthItem => ({
  name_ko: '성취',
  name_en: 'Achiever',
  domain: 'executing',
  ...over,
});

// ─────────────────────────────────────────────────────────────
// careerLabel
// ─────────────────────────────────────────────────────────────
describe('careerLabel', () => {
  it('알려진 value → 표시 라벨', () => {
    expect(careerLabel('junior_new')).toBe('신입 (0년)');
    expect(careerLabel('junior')).toBe('주니어 (1~3년)');
    expect(careerLabel('senior_mid')).toBe('미드 (4~7년)');
    expect(careerLabel('senior')).toBe('시니어 (8년+)');
  });

  it('모든 옵션 라벨이 매핑됨 (회귀 방지)', () => {
    for (const opt of CAREER_OPTIONS) {
      expect(careerLabel(opt.value)).toBe(opt.label);
    }
  });

  it('알 수 없는 value → 원본 그대로(폴백)', () => {
    expect(careerLabel('unknown')).toBe('unknown');
  });

  it('빈 문자열 → 빈 문자열(매칭 실패 폴백)', () => {
    expect(careerLabel('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// mapProfileRow
// ─────────────────────────────────────────────────────────────
describe('mapProfileRow', () => {
  it('모든 필드 정상 매핑', () => {
    const row = { nickname: '코코', job_field: 'IT/개발', career_level: 'junior' };
    expect(mapProfileRow(row, 'a@b.com')).toEqual({
      nickname: '코코',
      email: 'a@b.com',
      jobField: 'IT/개발',
      careerLevel: 'junior',
    });
  });

  it('row가 null/undefined → 전부 빈 문자열(email만 반영)', () => {
    expect(mapProfileRow(null, 'a@b.com')).toEqual({
      nickname: '', email: 'a@b.com', jobField: '', careerLevel: '',
    });
    expect(mapProfileRow(undefined, 'a@b.com')).toEqual({
      nickname: '', email: 'a@b.com', jobField: '', careerLevel: '',
    });
  });

  it('필드가 null → 빈 문자열로 디폴트', () => {
    const row = { nickname: null, job_field: null, career_level: null };
    expect(mapProfileRow(row, null)).toEqual({
      nickname: '', email: '', jobField: '', careerLevel: '',
    });
  });

  it('email이 null/undefined → 빈 문자열', () => {
    expect(mapProfileRow({ nickname: '코코' }, null).email).toBe('');
    expect(mapProfileRow({ nickname: '코코' }, undefined).email).toBe('');
  });

  it('일부 필드만 존재해도 나머지는 빈 문자열', () => {
    expect(mapProfileRow({ nickname: '코코' }, 'a@b.com')).toEqual({
      nickname: '코코', email: 'a@b.com', jobField: '', careerLevel: '',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// isValidStrengthItem
// ─────────────────────────────────────────────────────────────
describe('isValidStrengthItem', () => {
  it('정상 객체 → true (domain 없어도 OK)', () => {
    expect(isValidStrengthItem(strength())).toBe(true);
    expect(isValidStrengthItem({ name_ko: '성취', name_en: 'Achiever' })).toBe(true);
  });

  it('null/원시값/배열 → false', () => {
    expect(isValidStrengthItem(null)).toBe(false);
    expect(isValidStrengthItem(undefined)).toBe(false);
    expect(isValidStrengthItem('성취')).toBe(false);
    expect(isValidStrengthItem(42)).toBe(false);
    expect(isValidStrengthItem(['성취'])).toBe(false);
  });

  it('name_ko/name_en 누락 또는 비문자열 → false', () => {
    expect(isValidStrengthItem({ name_en: 'Achiever' })).toBe(false);
    expect(isValidStrengthItem({ name_ko: '성취' })).toBe(false);
    expect(isValidStrengthItem({ name_ko: 1, name_en: 'A' })).toBe(false);
    expect(isValidStrengthItem({ name_ko: '성취', name_en: null })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// normalizeStrengths — JSONB 하드닝
// ─────────────────────────────────────────────────────────────
describe('normalizeStrengths', () => {
  it('배열이 아니면 빈 배열', () => {
    expect(normalizeStrengths(null)).toEqual([]);
    expect(normalizeStrengths(undefined)).toEqual([]);
    expect(normalizeStrengths('성취')).toEqual([]);
    expect(normalizeStrengths(42)).toEqual([]);
    expect(normalizeStrengths({ name_ko: '성취', name_en: 'A' })).toEqual([]); // 객체(배열 아님)
  });

  it('정상 배열 → 그대로 보존(순서 유지)', () => {
    const arr = [strength({ name_ko: 'A', name_en: 'A' }), strength({ name_ko: 'B', name_en: 'B' })];
    expect(normalizeStrengths(arr)).toEqual(arr);
  });

  it('손상 원소만 제거(렌더 undefined 노출 방지)', () => {
    const mixed = [
      strength({ name_ko: '성취', name_en: 'Achiever' }),
      { name_en: 'Broken' },          // name_ko 누락
      null,                            // 원시값
      { name_ko: '공감', name_en: 'Empathy' },
    ];
    expect(normalizeStrengths(mixed)).toEqual([
      strength({ name_ko: '성취', name_en: 'Achiever' }),
      { name_ko: '공감', name_en: 'Empathy' },
    ]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(normalizeStrengths([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// displayStrengths — Top N 슬라이스
// ─────────────────────────────────────────────────────────────
describe('displayStrengths', () => {
  it(`최대 ${STRENGTHS_DISPLAY_MAX}개로 자름`, () => {
    const seven = Array.from({ length: 7 }, (_, i) =>
      strength({ name_ko: `s${i}`, name_en: `S${i}` }),
    );
    expect(displayStrengths(seven)).toHaveLength(STRENGTHS_DISPLAY_MAX);
  });

  it('5개 이하면 그대로(원본 순서 보존)', () => {
    const three = [strength({ name_en: 'A' }), strength({ name_en: 'B' }), strength({ name_en: 'C' })];
    expect(displayStrengths(three)).toEqual(three);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(displayStrengths([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// canSaveProfile — 저장 게이트
// ─────────────────────────────────────────────────────────────
describe('canSaveProfile', () => {
  it('닉네임 있고 저장 중 아님 → true', () => {
    expect(canSaveProfile('코코', false)).toBe(true);
  });

  it('저장 중 → false', () => {
    expect(canSaveProfile('코코', true)).toBe(false);
  });

  it('닉네임 공백/빈 문자열 → false', () => {
    expect(canSaveProfile('', false)).toBe(false);
    expect(canSaveProfile('   ', false)).toBe(false);
  });

  it('boolean을 반환(truthy 문자열 누출 없음)', () => {
    expect(canSaveProfile('', false)).toBe(false);
    expect(canSaveProfile('코코', false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// buildProfileUpdate — update 페이로드
// ─────────────────────────────────────────────────────────────
describe('buildProfileUpdate', () => {
  it('닉네임 trim + 직무/경력 그대로', () => {
    expect(buildProfileUpdate('  코코  ', 'IT/개발', 'junior')).toEqual({
      nickname: '코코',
      job_field: 'IT/개발',
      career_level: 'junior',
    });
  });

  it('DB 계약 키만 포함(nickname/job_field/career_level)', () => {
    const payload = buildProfileUpdate('코코', 'IT/개발', 'junior');
    expect(Object.keys(payload).sort()).toEqual(['career_level', 'job_field', 'nickname']);
  });
});
