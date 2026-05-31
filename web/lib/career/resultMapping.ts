/**
 * 09 커리어 방향 결과 — 저장/복원 관련 순수 로직.
 *
 * 세 가지 순수 함수:
 * 1. `domainToCode(domain)` — 갤럽 도메인명(strategic 등)을 goals.domain CHECK 코드(T/I/R/E)로 변환.
 *    매핑에 없으면 입력을 그대로 반환(방어적 fallback). 잘못된 매핑은 INSERT가 CHECK 위반으로
 *    실패하는 지점이라 회귀 위험이 큼 → 분리해서 테스트.
 * 2. `extractGrowthCompetencies(keyInsights)` — 08 인터뷰 key_insights(JSONB)에서
 *    growth_competencies 배열을 안전하게 추출. null/비객체/비배열/잘못된 원소를 모두 방어.
 *    deterministicMatch에 항상 깨끗한 string[]을 넘기기 위함.
 * 3. `hasStoredSlots(value)` — recommended_competencies 복원 가드.
 *    새로고침 시 이미 저장된 슬롯이 있으면 재계산 없이 그대로 사용.
 *
 * 이전엔 app/onboarding/career-result/page.tsx 내부 로직. 단위 테스트 가능하도록 분리.
 */

import type { Domain } from '@/lib/constants/strengths';

// goals.domain 컬럼은 T/I/R/E 단일 문자 CHECK. 갤럽 도메인명 → 코드 매핑.
export const DOMAIN_CODE_BY_NAME: Record<Domain, string> = {
  strategic: 'T',
  influencing: 'I',
  relationship: 'R',
  executing: 'E',
};

/**
 * 도메인명 → CHECK 코드. 매핑에 없거나 falsy면 입력을 그대로 반환(null/undefined → '').
 * 이미 코드(T/I/R/E)가 들어와도 매핑에 없으므로 그대로 통과한다.
 */
export function domainToCode(domain: string | null | undefined): string {
  if (!domain) return '';
  return DOMAIN_CODE_BY_NAME[domain as Domain] ?? domain;
}

/**
 * key_insights JSONB에서 growth_competencies 코드 배열을 안전하게 추출.
 * - keyInsights가 null/비객체면 [].
 * - growth_competencies가 없거나 배열이 아니면 [].
 * - 배열이면 string 원소만 남겨 반환(순서 보존).
 */
export function extractGrowthCompetencies(keyInsights: unknown): string[] {
  if (!keyInsights || typeof keyInsights !== 'object') return [];
  const raw = (keyInsights as { growth_competencies?: unknown }).growth_competencies;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === 'string');
}

/**
 * 저장된 추천 슬롯이 유효하게 존재하는지 가드.
 * (배열이고 비어있지 않으면 복원 대상으로 간주.)
 */
export function hasStoredSlots<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}
