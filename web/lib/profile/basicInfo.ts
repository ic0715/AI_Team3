/**
 * 온보딩 기본정보 화면(app/onboarding/profile/page.tsx) — 순수 로직.
 *
 * 페이지에 인라인돼 있던 검증/게이팅/날짜/draft 로직을 단위 테스트 가능하도록 분리.
 *
 * 1. `maxBirthdate(now)` — 만 14세 이상 기준 max 생년월일.
 *    (버그 수정) 기존 getMaxBirthdate는 `toISOString().split('T')[0]`로 UTC 날짜를
 *    뽑아, KST 새벽 시간대에 하루 밀리는 문제가 있었다. → localISODate(로컬) 사용.
 * 2. `validateBasicInfo(form, isEditMode)` — 제출 시 필드 검증(에러 메시지 맵).
 * 3. `isBasicInfoChanged` / `canSubmitBasicInfo` — 버튼 활성화 게이팅.
 * 4. `parseRecentDraft(raw, now)` — sessionStorage draft 복원(1시간 TTL + 파싱 안전).
 */

import { localISODate } from '@/lib/utils/localDate';

/** 닉네임 최대 길이. */
export const NICKNAME_MAX = 10;

/** draft 유효 기간 (1시간). 이보다 오래된 draft는 최신 DB 값을 덮지 않도록 폐기. */
export const DRAFT_TTL_MS = 60 * 60 * 1000;

/** 제출 검증 + 버튼 게이팅에 쓰는 필드. */
export interface BasicInfoForm {
  nickname: string;
  birthdate: string;
  jobField: string;
  careerLevel: string;
}

/** 수정 모드 변경 감지에 쓰는 필드(생년월일 제외 — 수정 불가). */
export interface EditableFields {
  nickname: string;
  gender: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
}

export interface BasicInfoErrors {
  nickname?: string;
  birthdate?: string;
  job?: string;
  career?: string;
}

/**
 * 만 14세 이상 기준 max 생년월일(YYYY-MM-DD, 로컬 기준).
 * now로부터 14년 전. localISODate로 포맷해 UTC 경계 버그를 피한다.
 */
export function maxBirthdate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 14);
  return localISODate(d);
}

/**
 * 제출 시 필드 검증. 에러가 없으면 빈 객체.
 * - 닉네임: 필수, trim 후 NICKNAME_MAX 초과 불가.
 * - 생년월일: 신규(비수정) 모드에서만 필수.
 * - 직무/경력: 항상 필수.
 */
export function validateBasicInfo(
  form: BasicInfoForm,
  isEditMode: boolean,
): BasicInfoErrors {
  const errors: BasicInfoErrors = {};
  const nick = form.nickname.trim();

  if (!nick) {
    errors.nickname = '닉네임을 입력해주세요';
  } else if (nick.length > NICKNAME_MAX) {
    errors.nickname = `닉네임은 ${NICKNAME_MAX}자 이하로 입력 가능합니다`;
  }

  if (!isEditMode && !form.birthdate) {
    errors.birthdate = '생년월일을 입력해주세요';
  }
  if (!form.jobField) {
    errors.job = '직업/분야를 선택해주세요';
  }
  if (!form.careerLevel) {
    errors.career = '경력을 선택해주세요';
  }

  return errors;
}

/** 에러 맵에 항목이 하나라도 있으면 true. */
export function hasBasicInfoErrors(errors: BasicInfoErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** 수정 모드 — 원본 대비 변경된 필드가 하나라도 있으면 true. */
export function isBasicInfoChanged(
  current: EditableFields,
  original: EditableFields,
): boolean {
  return (
    current.nickname !== original.nickname ||
    current.gender !== original.gender ||
    current.jobField !== original.jobField ||
    current.careerLevel !== original.careerLevel ||
    current.mainConcern !== original.mainConcern
  );
}

/**
 * 저장 버튼 활성화 여부.
 * - 필수값(닉네임/직무/경력 + 신규모드면 생년월일)이 모두 채워져야 함.
 * - 수정 모드면 변경사항(changed)이 있어야 함. 신규 모드면 changed 무관.
 */
export function canSubmitBasicInfo(
  form: BasicInfoForm,
  isEditMode: boolean,
  changed: boolean,
): boolean {
  const requiredFilled =
    Boolean(form.nickname.trim()) &&
    Boolean(form.jobField) &&
    Boolean(form.careerLevel) &&
    (isEditMode || Boolean(form.birthdate));

  return requiredFilled && (!isEditMode || changed);
}

export interface BasicInfoDraft {
  nickname?: string;
  gender?: string;
  jobField?: string;
  careerLevel?: string;
  mainConcern?: string;
  savedAt?: number;
}

export type DraftRestore =
  | { apply: BasicInfoDraft; removeStale: false }
  | { apply: null; removeStale: boolean };

/**
 * sessionStorage draft 원문을 복원 가능 형태로 해석.
 * - null/빈문자열/JSON 오류/비객체 → { apply: null, removeStale: false } (그냥 무시).
 * - savedAt 없음 또는 TTL 경과 → { apply: null, removeStale: true } (폐기 대상).
 * - 최근(savedAt + TTL 이내) → { apply: draft, removeStale: false } (필드 적용 대상).
 */
export function parseRecentDraft(
  raw: string | null | undefined,
  now: number = Date.now(),
): DraftRestore {
  if (!raw) return { apply: null, removeStale: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { apply: null, removeStale: false };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { apply: null, removeStale: false };
  }

  const draft = parsed as BasicInfoDraft;
  const isRecent =
    typeof draft.savedAt === 'number' && now - draft.savedAt < DRAFT_TTL_MS;

  if (!isRecent) return { apply: null, removeStale: true };
  return { apply: draft, removeStale: false };
}
