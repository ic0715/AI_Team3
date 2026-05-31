/**
 * 마이페이지(app/profile/page.tsx) — 순수 로직 추출.
 *
 * 페이지 컴포넌트에 인라인돼 있던 라벨 매핑 / 프로필 행 매핑 /
 * 강점(JSONB) 정규화 / 저장 게이팅·페이로드 로직을 단위 테스트 가능하도록 분리.
 *
 * 핵심 하드닝:
 * - normalizeStrengths: strength_analyses.strengths(JSONB)가 배열이 아니거나
 *   원소 shape가 손상된 경우(name_ko/name_en 누락) 렌더에서 undefined가 노출되지
 *   않도록 사전에 걸러낸다.
 */

/** 경력 레벨 옵션 (DB value ↔ 표시 라벨). 03 온보딩 / 14 마이페이지 공통. */
export const CAREER_OPTIONS = [
  { value: 'junior_new', label: '신입 (0년)' },
  { value: 'junior',     label: '주니어 (1~3년)' },
  { value: 'senior_mid', label: '미드 (4~7년)' },
  { value: 'senior',     label: '시니어 (8년+)' },
] as const;

/** 직업/분야 옵션. */
export const JOB_OPTIONS = [
  'IT/개발', '디자인', '기획/PM', '마케팅/영업', 'HR/인사',
  '재무/회계', '교육', '의료/보건', '제조/생산', '학생', '기타',
] as const;

/** 마이페이지 강점 섹션에서 보여줄 최대 개수(Top N). */
export const STRENGTHS_DISPLAY_MAX = 5;

export interface ProfileData {
  nickname: string;
  email: string;
  jobField: string;
  careerLevel: string;
}

/** profiles 테이블에서 읽어오는 행(부분). 모두 nullable로 가정. */
export interface ProfileRow {
  nickname?: string | null;
  job_field?: string | null;
  career_level?: string | null;
}

/** strength_analyses.strengths(JSONB) 원소 — 렌더에 쓰는 필드. */
export interface StrengthItem {
  name_ko: string;
  name_en: string;
  domain?: string;
}

/** profiles update 페이로드(컬럼명 = DB 계약). */
export interface ProfileUpdate {
  nickname: string;
  job_field: string;
  career_level: string;
}

/**
 * 경력 레벨 value → 표시 라벨. 매칭되는 옵션이 없으면 원본 value 그대로(폴백).
 * 빈 문자열도 매칭 실패 → '' 반환(호출부에서 `|| '—'` 처리).
 */
export function careerLabel(value: string): string {
  return CAREER_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

/**
 * profiles 행 + auth email → ProfileData. null/undefined-safe(`?? ''` 디폴트).
 */
export function mapProfileRow(
  row: ProfileRow | null | undefined,
  email: string | null | undefined,
): ProfileData {
  return {
    nickname: row?.nickname ?? '',
    email: email ?? '',
    jobField: row?.job_field ?? '',
    careerLevel: row?.career_level ?? '',
  };
}

/** StrengthItem로 안전하게 다룰 수 있는 shape인지 검사. */
export function isValidStrengthItem(v: unknown): v is StrengthItem {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s.name_ko === 'string' && typeof s.name_en === 'string';
}

/**
 * strength_analyses.strengths(JSONB) → 렌더 안전한 StrengthItem[].
 * - 배열이 아니면(null/객체/문자열 등) 빈 배열.
 * - name_ko/name_en이 문자열이 아닌 손상 원소는 제거(렌더 시 undefined 노출 방지).
 */
export function normalizeStrengths(raw: unknown): StrengthItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidStrengthItem);
}

/** 표시용 상위 N개 강점(STRENGTHS_DISPLAY_MAX). */
export function displayStrengths(strengths: StrengthItem[]): StrengthItem[] {
  return strengths.slice(0, STRENGTHS_DISPLAY_MAX);
}

/**
 * 기본정보 저장 가능 여부.
 * 닉네임(trim)이 비어 있거나 저장 중이면 false. 항상 boolean 반환.
 */
export function canSaveProfile(nickname: string, saving: boolean): boolean {
  return Boolean(nickname.trim()) && !saving;
}

/**
 * profiles update 페이로드 구성. 닉네임은 trim 적용, 직무/경력은 그대로.
 */
export function buildProfileUpdate(
  nickname: string,
  jobField: string,
  careerLevel: string,
): ProfileUpdate {
  return {
    nickname: nickname.trim(),
    job_field: jobField,
    career_level: careerLevel,
  };
}
