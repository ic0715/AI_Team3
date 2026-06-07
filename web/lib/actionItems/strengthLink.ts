/**
 * LLM이 생성한 `strength_link` 문자열을 사용자 Top5 강점의 **정식 한글명**으로 정규화한다 (순수 로직).
 *
 * 배경: 생성 콜에서 LLM은 강점명을 살짝 다르게 적는다 — "분석적 사고"(접미 추가),
 * "Analytical"(영문), "분석 "(공백) 등. 기존 sanitize는 Top5와 **정확 문자열 일치**만
 * 통과시켜(strengthSet.has) 이런 변형이 전부 탈락 → 생성 통과율이 떨어지고 풀 폴백이 늘었다.
 * 이 함수는 변형을 정식 한글명으로 되돌려 통과율을 회복한다.
 *
 * 안전 원칙(보수적):
 *  - 화이트리스트 기반 — Top5(strengthSet) + 갤럽 34테마(STRENGTHS) 안에서만 매칭.
 *  - 자유/유사어 매칭 금지. 매칭 실패 시 null을 반환해 **여전히 탈락**시킨다(강점연계는 제품 핵심).
 *  - 반환값은 항상 strengthSet의 원소이거나 null이라, 후속 단계의 `strengthSet.has()`가 그대로 통과한다.
 *
 * 매칭 순서(엄격 → 느슨):
 *   ① 정확 일치
 *   ② 공백 제거 후 일치
 *   ③ 영문명(name_en, 대소문자 무시) → 한글명 → Top5 포함 시
 *   ④ Top5 강점명이 raw에 부분 포함("분석적 사고" ⊇ "분석") — 정식명 전체가 들어있을 때만
 */
import { STRENGTHS } from '@/lib/constants/strengths';

// 영문명(소문자) → 한글명 (갤럽 34테마 고정 매핑). 모듈 로드 시 1회 구성.
const KO_BY_EN = new Map<string, string>();
for (const st of STRENGTHS) {
  KO_BY_EN.set(st.nameEn.toLowerCase(), st.name);
}

const stripSpaces = (s: string): string => s.replace(/\s+/g, '');

/**
 * raw를 strengthSet(사용자 Top5 한글명)의 정식 원소로 정규화. 못 찾으면 null.
 * @param raw         LLM이 적은 strength_link (어떤 타입이든 방어).
 * @param strengthSet 사용자 Top5 강점 한글명 집합(정식명).
 */
export function normalizeStrengthLink(
  raw: unknown,
  strengthSet: Set<string>,
): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // ① 정확 일치
  if (strengthSet.has(trimmed)) return trimmed;

  // ② 공백 제거 후 일치
  const collapsed = stripSpaces(trimmed);
  for (const s of strengthSet) {
    if (stripSpaces(s) === collapsed) return s;
  }

  // ③ 영문명 → 한글명 → Top5 포함 시
  const ko = KO_BY_EN.get(trimmed.toLowerCase());
  if (ko && strengthSet.has(ko)) return ko;

  // ④ Top5 정식명이 raw에 통째로 부분 포함 (예: "분석적 사고" ⊇ "분석")
  for (const s of strengthSet) {
    const cs = stripSpaces(s);
    if (cs.length > 0 && collapsed.includes(cs)) return s;
  }

  return null;
}
