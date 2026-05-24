// CareerPT DB 타입 정의
// 수동 정의 (supabase gen types 미사용)
// 스키마 버전: v0.9

// ────────────────────────────────────────────────────────────
// career_interview_results
// ────────────────────────────────────────────────────────────

/** 인터뷰 시간 깊이 분류 (v0.9 신규) */
export type SessionDurationChoice = 'short' | 'medium' | 'long';

/** key_insights JSONB 구조 (v0.9 — 커리어 인터뷰 v2) */
export interface CareerInterviewKeyInsights {
  // 신규 4키 (v0.9)
  presenting_issue?: string;      // 필수 — 사용자가 처음 가져온 표면 이슈
  agreed_focus?: string;          // 필수 — 최종 합의된 다루기로 한 주제
  agreement_evolution?: string;   // optional — 합의 재조정이 있었다면 그 흐름
  user_takeaway?: string;         // 필수 — 사용자의 마무리 인사이트

  // 기존 7키 (모두 optional, 중첩 객체로 이동)
  key_insights?: {
    current_satisfaction?: string;
    current_frustration?: string;
    future_vision?: string;
    work_style?: string;
    values?: string[];
    career_concern?: string;
    dream?: string;
  };

  // 역량 추출 (기존 로직 유지)
  mentioned_competencies?: string[]; // T-1 ~ E-3, 0~3개
}

/** career_interview_results 테이블 Row 타입 */
export interface CareerInterviewResultRow {
  id: string;
  user_id: string;
  interviewed_at: string;
  /** Path C(정서 위기 redirect) 시 NULL */
  key_insights: CareerInterviewKeyInsights | null;
  /** v0.9 신규. 기존 row는 DEFAULT 'medium'으로 채워짐 */
  session_duration_choice: SessionDurationChoice;
  ai_summary: string;
  /** 본 단계 NULL, #3 역량 방향 도출 단계에서 UPDATE */
  recommended_competencies: unknown | null;
}
