/**
 * 06 강점 선택 화면 — 저장/복원/선택 관련 순수 로직.
 *
 * 페이지(app/onboarding/strengths/page.tsx) 내부에 있던 위험 로직을 단위 테스트
 * 가능하도록 분리한다. 세 가지 관심사:
 *
 * 1. `parseStoredStrengths(raw, userId)` — localStorage 복원 가드.
 *    - 다른 계정 데이터 격리(userId 불일치 → null).
 *    - JSON 파싱 실패/비객체/배열 아님/5개 초과 → null.
 *    - (하드닝) 원소 shape 검증: 손상되거나 구버전 형식(예: domain 누락)이 들어오면
 *      이후 DOMAIN_STYLES[s.domain] 조회가 undefined가 되어 렌더가 크래시했다.
 *      → 원소 중 하나라도 형식이 깨지면 복원하지 않고 null 반환(빈 상태로 시작).
 *
 * 2. `toggleStrength(prev, strength)` — 5개 상한 칩 토글.
 *    - 이미 선택 → 해제. 미선택 + 5개 미만 → 추가. 5개 도달 → 무시(동일 참조 반환).
 *    - cap 시 동일 참조를 반환하므로 호출부가 `next !== prev`로 저장 스킵 판단 가능.
 *
 * 3. `buildStrengthsPayload(selected)` — DB(strength_analyses.strengths) 페이로드.
 *    - 선택 순서를 1-based rank로 부여. 08 인터뷰/09 결과가 소비하는 JSONB 계약.
 */

import type { Domain, Strength } from '@/lib/constants/strengths';

/** localStorage 키 — 페이지와 공유. */
export const STRENGTHS_LS_KEY = 'selectedStrengths';

/** 최대 선택 개수 (갤럽 Top 5). */
export const MAX_STRENGTHS = 5;

/** 화면에서 보관하는 선택 강점 형태 (DB 페이로드와 구분). */
export interface SelectedStrength {
  id: string;
  name: string;
  nameEn: string;
  domain: Domain;
}

/** DB(strength_analyses.strengths) JSONB 원소 형태. */
export interface StrengthPayloadItem {
  rank: number;
  name_ko: string;
  name_en: string;
  domain: Domain;
}

const VALID_DOMAINS: ReadonlySet<string> = new Set<Domain>([
  'executing',
  'influencing',
  'relationship',
  'strategic',
]);

function isDomain(value: unknown): value is Domain {
  return typeof value === 'string' && VALID_DOMAINS.has(value);
}

/** 복원 대상 원소가 SelectedStrength 형태인지 검증 (크래시 방어). */
export function isValidSelectedStrength(value: unknown): value is SelectedStrength {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.nameEn === 'string' &&
    isDomain(o.domain)
  );
}

/**
 * localStorage 원문(raw)을 현재 유저의 선택 강점 배열로 안전하게 복원.
 * 복원 불가(파싱 실패/타계정/형식 손상/5개 초과)면 null → 호출부는 빈 상태로 시작.
 */
export function parseStoredStrengths(
  raw: string | null | undefined,
  currentUserId: string,
): SelectedStrength[] | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { userId?: unknown; strengths?: unknown };

  // 다른 계정 데이터는 복원하지 않음 (프라이버시/격리).
  if (obj.userId !== currentUserId) return null;

  if (!Array.isArray(obj.strengths)) return null;
  if (obj.strengths.length > MAX_STRENGTHS) return null;

  // 원소 중 하나라도 형식이 깨지면 전체 복원 포기 (부분 손상 데이터 차단).
  if (!obj.strengths.every(isValidSelectedStrength)) return null;

  return obj.strengths as SelectedStrength[];
}

/**
 * 강점 칩 토글. 5개 상한.
 * - 이미 선택된 강점 → 해제한 새 배열.
 * - 미선택 + 5개 미만 → 추가한 새 배열.
 * - 미선택 + 이미 5개 → 변경 없이 동일 참조(prev) 반환.
 */
export function toggleStrength(
  prev: SelectedStrength[],
  strength: Strength,
): SelectedStrength[] {
  const alreadySelected = prev.some((s) => s.id === strength.id);

  if (alreadySelected) {
    return prev.filter((s) => s.id !== strength.id);
  }

  if (prev.length >= MAX_STRENGTHS) return prev;

  return [
    ...prev,
    {
      id: strength.id,
      name: strength.name,
      nameEn: strength.nameEn,
      domain: strength.domain,
    },
  ];
}

/**
 * 선택 강점 배열을 DB 페이로드로 변환. 배열 순서대로 1-based rank 부여.
 */
export function buildStrengthsPayload(
  selected: SelectedStrength[],
): StrengthPayloadItem[] {
  return selected.map((s, idx) => ({
    rank: idx + 1,
    name_ko: s.name,
    name_en: s.nameEn,
    domain: s.domain,
  }));
}
