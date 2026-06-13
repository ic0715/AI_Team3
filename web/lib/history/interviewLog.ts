/**
 * 14 히스토리(인터뷰 보관함) — 인터뷰 로그 표시용 순수 로직.
 *
 * career_interview_results 의 conversation_messages(JSONB) / key_insights / 요약을
 * 카드·대화 전문 뷰모델로 가공한다. React/Supabase 의존 없는 순수 함수.
 *
 * ⚠️ conversation_messages 의 user content 에는 AI 전송용
 *    `<현재_상태>...</현재_상태>` prefix 가 그대로 저장돼 있다(저장 시 UI용 displayContent 가
 *    아니라 content 를 넣음 — career-interview/page.tsx finalize). 화면 표시 전 반드시
 *    stripStateBlock 으로 제거한다 — 0613 버그픽스(6fe5e22, page.tsx 복원 로직)와 동일 정규식.
 */

import type { CareerInterviewKeyInsights } from '@/lib/types/database';

/** 인터뷰 대화 메시지(DB 저장 형태). */
export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 화면 표시용 메시지(상태 블록 제거 완료). */
export interface DisplayMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** key_insights 에서 카드에 보여줄 하이라이트. */
export interface InsightHighlights {
  presentingIssue: string; // 처음 가져온 표면 이슈
  agreedFocus: string;     // 최종 합의된 주제
  takeaway: string;        // 사용자의 마무리 인사이트
}

// user 메시지의 <현재_상태>...</현재_상태> prefix 제거 정규식.
// career-interview/page.tsx 의 in_progress 복원 로직과 동일.
export const STATE_BLOCK_RE = /^<현재_상태>[\s\S]*?<\/현재_상태>\n?/;

/**
 * user content 앞부분의 상태 블록을 제거하고 trim.
 * (assistant 등 그 외 역할은 호출부에서 trim 만 적용)
 */
export function stripStateBlock(content: string): string {
  return content.replace(STATE_BLOCK_RE, '').trim();
}

/**
 * conversation_messages(JSONB, unknown) → 표시용 메시지 배열.
 * - 배열이 아니면 빈 배열.
 * - role 이 'user'|'assistant' 이고 content 가 string 인 항목만 통과(손상 데이터 방어).
 * - user 는 상태 블록 제거, 그 외는 trim.
 * - 정제 후 빈 문자열이 된 메시지는 제외(빈 말풍선 방지).
 */
export function toDisplayMessages(raw: unknown): DisplayMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: DisplayMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as { role?: unknown; content?: unknown };
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    if (typeof msg.content !== 'string') continue;
    const text = msg.role === 'user' ? stripStateBlock(msg.content) : msg.content.trim();
    if (!text) continue;
    out.push({ role: msg.role, text });
  }
  return out;
}

/** 표시용 메시지 중 user 발화 수(카드의 "내 답변 N" 표시용). */
export function countUserMessages(messages: DisplayMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

/**
 * 카드 요약 텍스트 선택.
 * conversation_summary 우선, 비면 ai_summary, 둘 다 비면 ''.
 */
export function pickInterviewSummary(
  conversationSummary: string | null | undefined,
  aiSummary: string | null | undefined,
): string {
  const cs = (conversationSummary ?? '').trim();
  if (cs) return cs;
  return (aiSummary ?? '').trim();
}

/**
 * key_insights(JSONB, unknown) → 카드 하이라이트.
 * null/비객체/누락 필드를 모두 방어(빈 문자열 폴백). Path C(정서 위기) row 는 key_insights=null.
 */
export function extractInsightHighlights(keyInsights: unknown): InsightHighlights {
  const empty: InsightHighlights = { presentingIssue: '', agreedFocus: '', takeaway: '' };
  if (!keyInsights || typeof keyInsights !== 'object') return empty;
  const ki = keyInsights as CareerInterviewKeyInsights;
  return {
    presentingIssue: typeof ki.presenting_issue === 'string' ? ki.presenting_issue.trim() : '',
    agreedFocus: typeof ki.agreed_focus === 'string' ? ki.agreed_focus.trim() : '',
    takeaway: typeof ki.user_takeaway === 'string' ? ki.user_takeaway.trim() : '',
  };
}

/**
 * ISO timestamp → 'YYYY.MM.DD' (로컬 기준).
 * null/빈값/파싱 실패 시 '' 반환(호출부에서 폴백 처리).
 */
export function formatInterviewDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
