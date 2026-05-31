import { describe, expect, it } from 'vitest';
import {
  canSubmitBasicInfo,
  DRAFT_TTL_MS,
  hasBasicInfoErrors,
  isBasicInfoChanged,
  maxBirthdate,
  NICKNAME_MAX,
  parseRecentDraft,
  validateBasicInfo,
  type BasicInfoForm,
  type EditableFields,
} from './basicInfo';

const form = (over: Partial<BasicInfoForm> = {}): BasicInfoForm => ({
  nickname: '코코',
  birthdate: '1990-01-01',
  jobField: 'IT/개발',
  careerLevel: 'junior',
  ...over,
});

const editable = (over: Partial<EditableFields> = {}): EditableFields => ({
  nickname: '코코',
  gender: '남성',
  jobField: 'IT/개발',
  careerLevel: 'junior',
  mainConcern: '이직 고민',
  ...over,
});

// ─────────────────────────────────────────────────────────────
// maxBirthdate — UTC 버그 수정 (로컬 날짜)
// ─────────────────────────────────────────────────────────────
describe('maxBirthdate', () => {
  it('now로부터 정확히 14년 전 로컬 날짜', () => {
    // 로컬 생성자 → TZ 무관 결정적
    expect(maxBirthdate(new Date(2026, 5, 1))).toBe('2012-06-01');
    expect(maxBirthdate(new Date(2000, 0, 15))).toBe('1986-01-15');
  });

  it('월/일 zero-padding', () => {
    expect(maxBirthdate(new Date(2026, 2, 5))).toBe('2012-03-05');
  });

  it('자정 직후(로컬)에도 날짜가 밀리지 않음 (UTC 버그 회귀 방지)', () => {
    // 과거 toISOString 방식은 KST 자정~09시 사이 하루 밀렸음.
    expect(maxBirthdate(new Date(2026, 5, 1, 0, 30))).toBe('2012-06-01');
  });

  it('인자 없으면 현재 시각 기준으로 동작 (문자열 형식만 검증)', () => {
    expect(maxBirthdate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─────────────────────────────────────────────────────────────
// validateBasicInfo
// ─────────────────────────────────────────────────────────────
describe('validateBasicInfo', () => {
  it('모든 필드 정상(신규 모드) → 에러 없음', () => {
    const errors = validateBasicInfo(form(), false);
    expect(errors).toEqual({});
    expect(hasBasicInfoErrors(errors)).toBe(false);
  });

  it('닉네임 공백 → 필수 에러', () => {
    expect(validateBasicInfo(form({ nickname: '   ' }), false).nickname).toBe(
      '닉네임을 입력해주세요',
    );
  });

  it(`닉네임 ${NICKNAME_MAX}자 초과 → 길이 에러`, () => {
    const long = 'a'.repeat(NICKNAME_MAX + 1);
    expect(validateBasicInfo(form({ nickname: long }), false).nickname).toBe(
      `닉네임은 ${NICKNAME_MAX}자 이하로 입력 가능합니다`,
    );
  });

  it(`닉네임 정확히 ${NICKNAME_MAX}자(경계) → 통과`, () => {
    const exact = 'a'.repeat(NICKNAME_MAX);
    expect(validateBasicInfo(form({ nickname: exact }), false).nickname).toBeUndefined();
  });

  it('신규 모드에서 생년월일 없음 → 에러', () => {
    expect(validateBasicInfo(form({ birthdate: '' }), false).birthdate).toBe(
      '생년월일을 입력해주세요',
    );
  });

  it('수정 모드에서는 생년월일 없어도 에러 없음', () => {
    expect(validateBasicInfo(form({ birthdate: '' }), true).birthdate).toBeUndefined();
  });

  it('직무/경력 미선택 → 각각 에러', () => {
    const errors = validateBasicInfo(form({ jobField: '', careerLevel: '' }), false);
    expect(errors.job).toBe('직업/분야를 선택해주세요');
    expect(errors.career).toBe('경력을 선택해주세요');
  });

  it('여러 에러 동시 수집', () => {
    const errors = validateBasicInfo(
      { nickname: '', birthdate: '', jobField: '', careerLevel: '' },
      false,
    );
    expect(Object.keys(errors).sort()).toEqual(['birthdate', 'career', 'job', 'nickname']);
    expect(hasBasicInfoErrors(errors)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// isBasicInfoChanged
// ─────────────────────────────────────────────────────────────
describe('isBasicInfoChanged', () => {
  it('모든 필드 동일 → false', () => {
    expect(isBasicInfoChanged(editable(), editable())).toBe(false);
  });

  it('각 필드 변경 감지', () => {
    const base = editable();
    expect(isBasicInfoChanged(editable({ nickname: '다름' }), base)).toBe(true);
    expect(isBasicInfoChanged(editable({ gender: '여성' }), base)).toBe(true);
    expect(isBasicInfoChanged(editable({ jobField: '디자인' }), base)).toBe(true);
    expect(isBasicInfoChanged(editable({ careerLevel: 'senior' }), base)).toBe(true);
    expect(isBasicInfoChanged(editable({ mainConcern: '다른 고민' }), base)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// canSubmitBasicInfo
// ─────────────────────────────────────────────────────────────
describe('canSubmitBasicInfo', () => {
  it('신규 모드: 필수 모두 채워지면 true (changed 무관)', () => {
    expect(canSubmitBasicInfo(form(), false, false)).toBe(true);
  });

  it('신규 모드: 생년월일 없으면 false', () => {
    expect(canSubmitBasicInfo(form({ birthdate: '' }), false, false)).toBe(false);
  });

  it('신규 모드: 닉네임 공백이면 false', () => {
    expect(canSubmitBasicInfo(form({ nickname: '  ' }), false, false)).toBe(false);
  });

  it('수정 모드: 변경 없으면 false', () => {
    expect(canSubmitBasicInfo(form(), true, false)).toBe(false);
  });

  it('수정 모드: 변경 있으면 true (생년월일 없어도 OK)', () => {
    expect(canSubmitBasicInfo(form({ birthdate: '' }), true, true)).toBe(true);
  });

  it('수정 모드: 변경 있어도 필수(직무) 비면 false', () => {
    expect(canSubmitBasicInfo(form({ jobField: '' }), true, true)).toBe(false);
  });

  it('boolean을 반환 (truthy 문자열 누출 없음)', () => {
    expect(canSubmitBasicInfo(form({ nickname: '' }), false, false)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// parseRecentDraft — sessionStorage draft TTL
// ─────────────────────────────────────────────────────────────
describe('parseRecentDraft', () => {
  const now = 1_700_000_000_000;

  it('null/빈 문자열 → 무시 (apply null, removeStale false)', () => {
    expect(parseRecentDraft(null, now)).toEqual({ apply: null, removeStale: false });
    expect(parseRecentDraft('', now)).toEqual({ apply: null, removeStale: false });
  });

  it('JSON 파싱 실패 → 무시', () => {
    expect(parseRecentDraft('{broken', now)).toEqual({ apply: null, removeStale: false });
  });

  it('비객체(숫자/문자열) → 무시', () => {
    expect(parseRecentDraft('42', now)).toEqual({ apply: null, removeStale: false });
    expect(parseRecentDraft('"x"', now)).toEqual({ apply: null, removeStale: false });
  });

  it('savedAt 없음 → 폐기(removeStale true)', () => {
    expect(parseRecentDraft(JSON.stringify({ nickname: 'x' }), now)).toEqual({
      apply: null,
      removeStale: true,
    });
  });

  it('TTL 경과(1시간 이상) → 폐기', () => {
    const old = JSON.stringify({ nickname: 'x', savedAt: now - DRAFT_TTL_MS - 1 });
    expect(parseRecentDraft(old, now)).toEqual({ apply: null, removeStale: true });
  });

  it('정확히 TTL 경계(1시간) → 폐기 (< 비교라 경계는 stale)', () => {
    const edge = JSON.stringify({ nickname: 'x', savedAt: now - DRAFT_TTL_MS });
    expect(parseRecentDraft(edge, now)).toEqual({ apply: null, removeStale: true });
  });

  it('최근 draft → apply에 필드 그대로', () => {
    const draft = { nickname: '코코', jobField: 'IT/개발', savedAt: now - 1000 };
    const res = parseRecentDraft(JSON.stringify(draft), now);
    expect(res.removeStale).toBe(false);
    expect(res.apply).toEqual(draft);
  });
});
