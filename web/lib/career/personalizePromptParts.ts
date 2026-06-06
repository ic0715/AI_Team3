/**
 * 09 커리어 방향 결과 — Step2 개인화 프롬프트의 순수 포매팅 조각.
 *
 * career-personalize.ts(프롬프트 빌더)는 top-level에서 docs 파일을 fs.readFileSync 하므로
 * 그 자체로는 단위 테스트가 어렵다(파일시스템 의존). 사용자 입력을 프롬프트 문자열로
 * 가공하는 두 순수 함수만 분리해 결정적으로 테스트한다.
 *
 *  1. `careerLevelLabel(code)` — 경력 단계 코드를 한글 라벨로. 매핑에 없으면 입력 그대로.
 *  2. `formatInsights(raw)` — 08 인터뷰 key_insights(JSONB, unknown)를 프롬프트용
 *     bullet 문자열로. null/비객체/빈 객체를 모두 방어하고, values는 배열/문자열 모두 처리.
 *
 * 동작 보존(verbatim) 추출 — career-personalize.ts가 이 모듈을 import해 사용한다.
 */

interface KeyInsights {
  current_satisfaction?: string;
  current_frustration?: string;
  future_vision?: string;
  work_style?: string;
  values?: string[] | string;
  career_concern?: string;
  dream?: string;
}

/** 경력 단계 코드 → 한글 라벨. 매핑에 없으면 입력값을 그대로 반환. */
export function careerLevelLabel(careerLevel: string): string {
  return (
    {
      junior_new: '주니어(신입)',
      junior: '주니어(2~4년차)',
      senior_mid: '미드시니어(5~7년차)',
      senior: '시니어',
    } as Record<string, string>
  )[careerLevel] ?? careerLevel;
}

/**
 * key_insights(JSONB)를 프롬프트용 bullet 문자열로 가공.
 * - null/비객체 → '(인터뷰 인사이트 없음)'
 * - 모든 필드가 비어 있으면 → '(인터뷰 인사이트 비어있음)'
 * - values는 배열이면 ', '로 join, 문자열이면 그대로, 없으면 ''.
 */
export function formatInsights(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '(인터뷰 인사이트 없음)';
  const ki = raw as KeyInsights;
  const valuesStr = Array.isArray(ki.values)
    ? ki.values.join(', ')
    : (ki.values ?? '');
  const lines = [
    ki.current_satisfaction && `- 일에서 에너지: ${ki.current_satisfaction}`,
    ki.current_frustration && `- 답답한 순간: ${ki.current_frustration}`,
    ki.future_vision && `- 3~5년 비전: ${ki.future_vision}`,
    ki.work_style && `- 일하는 방식: ${ki.work_style}`,
    valuesStr && `- 핵심 가치: ${valuesStr}`,
    ki.career_concern && `- 커리어 고민: ${ki.career_concern}`,
    ki.dream && `- 장기 꿈: ${ki.dream}`,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : '(인터뷰 인사이트 비어있음)';
}
