'use client';

import { useEffect, useState, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import OnboardingRedirectModal from '@/components/OnboardingRedirectModal';
import { TabBar } from '@/components/ui/TabBar';
import {
  toDisplayMessages,
  countUserMessages,
  pickInterviewSummary,
  extractInsightHighlights,
  isDisplayableInterview,
  formatInterviewDate,
  type DisplayMessage,
} from '@/lib/history/interviewLog';

// ────────────────────────────────────────────────────────────
// 14 히스토리 — 인터뷰 보관함 (스펙 _post_mvp_v2 v2.0)
//
// 지난 AI 커리어 인터뷰(career_interview_results, status='completed')를
// 최신순 카드로 보여주고, 카드 탭 시 그때의 대화 전문을 모달로 다시 읽게 한다.
//
// 표시/정제 순수 로직은 @/lib/history/interviewLog 로 분리(단위 테스트).
//  ⚠️ conversation_messages 의 user content 에는 <현재_상태> 블록이 저장돼 있어
//     toDisplayMessages 가 표시 전 제거한다(0613 버그픽스와 동일).
// ────────────────────────────────────────────────────────────

interface InterviewRow {
  id: string;
  interviewed_at: string;
  ai_summary: string | null;
  conversation_summary: string | null;
  key_insights: unknown;
  conversation_messages: unknown;
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function HistoryPage() {
  return (
    <Suspense fallback={<LoadingScreen text="히스토리를 불러오는 중..." />}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const { ready, pendingRedirect, confirmRedirect } = useOnboardingGuard('complete');

  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 완료된 인터뷰만, 최신순. RLS 로 본인 것만 자동 필터되지만 user_id 도 명시.
        //  - status='completed': in_progress/abandoned 제외
        //  - key_insights NOT NULL: Path C(정서 위기 가드레일) 행 제외(내부 문구 노출 방지)
        const { data, error: qErr } = await supabase
          .from('career_interview_results')
          .select('id, interviewed_at, ai_summary, conversation_summary, key_insights, conversation_messages')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('key_insights', 'is', null)
          .order('interviewed_at', { ascending: false });

        if (cancelled) return;
        if (qErr) throw qErr;

        // 빈/손상 추출(필수 3키 모두 빈 값)도 클라이언트에서 한 번 더 방어 제외.
        const meaningful = (data ?? []).filter((r) =>
          isDisplayableInterview((r as InterviewRow).key_insights),
        );
        setRows(meaningful as InterviewRow[]);
        setLoading(false);
      } catch (e) {
        console.error('[14 history] load failed:', e);
        if (!cancelled) {
          setError('인터뷰 기록을 불러올 수 없어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reloadKey]);

  if (pendingRedirect) {
    return <OnboardingRedirectModal {...pendingRedirect} onConfirm={confirmRedirect} />;
  }
  if (!ready || loading) return <LoadingScreen text="히스토리를 준비하고 있어요..." />;

  const openRow = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={topbarStyle}>
        <div style={brandStyle}>
          CareerPT
          <sup style={brandDotStyle}>·</sup>
        </div>
        <span style={stepPillStyle}>히스토리</span>
      </header>

      <main style={screenStyle}>
        <div style={subtitleStyle}>인터뷰 보관함 📚</div>
        <h1 style={titleStyle}>
          지난 인터뷰를 <em style={emAccent}>다시 펼쳐봐요</em>
        </h1>
        <p style={leadStyle}>
          그동안 AI 코치와 나눈 커리어 인터뷰가 여기 쌓여요. 카드를 누르면
          그때의 대화 전문을 처음부터 다시 읽을 수 있어요.
        </p>

        {error && (
          <div role="alert" style={errorAlertStyle}>
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={retryBtnStyle}>
              다시 시도
            </button>
          </div>
        )}

        {rows.length === 0 && !error ? (
          <EmptyState />
        ) : (
          <ul style={listStyle}>
            {rows.map((row) => (
              <li key={row.id} style={{ listStyle: 'none' }}>
                <InterviewCard row={row} onOpen={() => setOpenId(row.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <TabBar active="history" />

      {openRow && <TranscriptModal row={openRow} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 인터뷰 요약 카드
// ────────────────────────────────────────────────────────────

function InterviewCard({ row, onOpen }: { row: InterviewRow; onOpen: () => void }) {
  const dateLabel = formatInterviewDate(row.interviewed_at) || '날짜 미상';
  const summary = pickInterviewSummary(row.conversation_summary, row.ai_summary);
  const { agreedFocus, takeaway } = extractInsightHighlights(row.key_insights);
  const userTurns = countUserMessages(toDisplayMessages(row.conversation_messages));

  return (
    <button type="button" style={cardStyle} onClick={onOpen} aria-label={`${dateLabel} 인터뷰 상세 보기`}>
      <div style={cardHeadStyle}>
        <span style={cardDateStyle}>{dateLabel}</span>
        <span style={cardCountChip}>💬 내 답변 {userTurns}</span>
      </div>

      {summary ? (
        <p style={cardSummaryStyle}>{summary}</p>
      ) : (
        <p style={{ ...cardSummaryStyle, color: 'var(--ink-mute)' }}>요약이 아직 없어요</p>
      )}

      {agreedFocus && <InsightLine label="다룬 주제" value={agreedFocus} clamp />}
      {takeaway && <InsightLine label="마무리 인사이트" value={takeaway} clamp />}

      <span style={cardCtaStyle}>대화 전문 보기 ›</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// 인사이트 한 줄 (카드 = 1줄 clamp, 모달 = 전체)
// ────────────────────────────────────────────────────────────

function InsightLine({ label, value, clamp = false }: { label: string; value: string; clamp?: boolean }) {
  return (
    <div style={insightLineStyle}>
      <span style={insightLabelStyle}>{label}</span>
      <span style={clamp ? insightValueClampStyle : insightValueStyle}>{value}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 대화 전문 모달 (바텀 시트)
// ────────────────────────────────────────────────────────────

function TranscriptModal({ row, onClose }: { row: InterviewRow; onClose: () => void }) {
  const messages = toDisplayMessages(row.conversation_messages);
  const dateLabel = formatInterviewDate(row.interviewed_at) || '인터뷰';
  const summary = pickInterviewSummary(row.conversation_summary, row.ai_summary);
  const { presentingIssue, agreedFocus, takeaway } = extractInsightHighlights(row.key_insights);
  const hasInsight = Boolean(summary || presentingIssue || agreedFocus || takeaway);

  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={modalOverlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${dateLabel} 인터뷰 대화 전문`}
    >
      <div style={modalSheetStyle} onClick={(e) => e.stopPropagation()}>
        <header style={modalHeaderStyle}>
          <div>
            <div style={modalDateStyle}>{dateLabel}</div>
            <div style={modalSubStyle}>인터뷰 대화 전문</div>
          </div>
          <button type="button" onClick={onClose} style={modalCloseBtnStyle} aria-label="닫기">
            ✕
          </button>
        </header>

        <div style={modalBodyStyle}>
          {hasInsight && (
            <div style={modalInsightBoxStyle}>
              {summary && <p style={modalSummaryStyle}>{summary}</p>}
              {presentingIssue && <InsightLine label="처음 가져온 고민" value={presentingIssue} />}
              {agreedFocus && <InsightLine label="다룬 주제" value={agreedFocus} />}
              {takeaway && <InsightLine label="마무리 인사이트" value={takeaway} />}
            </div>
          )}

          {messages.length === 0 ? (
            <p style={modalEmptyStyle}>과거 인터뷰는 요약 내용으로만 제공돼요.</p>
          ) : (
            <div style={chatColStyle}>
              {messages.map((m, i) => (
                <Bubble key={i} msg={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={isUser ? userBubbleStyle : aiBubbleStyle}>{msg.text}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 빈 상태 / 로딩
// ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={emptyWrapStyle}>
      <div style={{ fontSize: '40px' }} aria-hidden="true">📚</div>
      <div style={emptyTitleStyle}>아직 쌓인 인터뷰가 없어요</div>
      <div style={emptyBodyStyle}>
        AI 코치와 첫 커리어 인터뷰를 마치면<br />
        여기에 기록이 쌓여요.
      </div>
    </div>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={wrapStyle}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  height: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
  position: 'relative',
};

const topbarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px 14px',
  background: 'var(--bg)',
  flexShrink: 0,
};

const brandStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: '18px',
  letterSpacing: '-.02em',
  color: 'var(--ink)',
};

const brandDotStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--accent)',
};

const stepPillStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--accent)',
  padding: '5px 12px',
  borderRadius: '999px',
  background: 'var(--accent-tint)',
  fontWeight: 700,
};

const screenStyle: CSSProperties = {
  padding: '8px 22px 24px',
  flex: 1,
  overflowY: 'auto',
};

const subtitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '8px',
  color: 'var(--ink)',
};

const titleStyle: CSSProperties = {
  fontSize: '26px',
  fontWeight: 800,
  letterSpacing: '-.035em',
  lineHeight: 1.25,
  margin: '0 0 10px',
  color: 'var(--ink)',
};

const emAccent: CSSProperties = {
  fontStyle: 'normal',
  color: 'var(--accent)',
};

const leadStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
  margin: '0 0 22px',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  margin: 0,
  padding: 0,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '100%',
  textAlign: 'left',
  background: '#fff',
  border: '1.5px solid var(--line)',
  borderRadius: '18px',
  padding: '16px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
};

const cardHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const cardDateStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: '-.01em',
  color: 'var(--ink)',
};

const cardCountChip: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 9px',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  borderRadius: '999px',
  flexShrink: 0,
};

const cardSummaryStyle: CSSProperties = {
  margin: 0,
  fontSize: '13.5px',
  color: 'var(--ink)',
  lineHeight: 1.55,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const insightLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
};

const insightLabelStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--accent)',
};

const insightValueStyle: CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--ink-soft)',
  lineHeight: 1.55,
};

const insightValueClampStyle: CSSProperties = {
  ...insightValueStyle,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const cardCtaStyle: CSSProperties = {
  marginTop: '2px',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--accent)',
};

const errorAlertStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  padding: '10px 14px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

const retryBtnStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: '12px',
  fontWeight: 700,
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--danger)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const emptyWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  textAlign: 'center',
  padding: '48px 20px',
  border: '1.5px dashed var(--border)',
  borderRadius: '18px',
};

const emptyTitleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const emptyBodyStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted)',
  lineHeight: 1.6,
};

// ── 모달 ──────────────────────────────────────────────────────

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
};

const modalSheetStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  maxHeight: '88dvh',
  background: 'var(--surface)',
  borderRadius: '20px 20px 0 0',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 -8px 40px rgba(0,0,0,0.22)',
};

const modalHeaderStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '18px 20px 14px',
  borderBottom: '1px solid var(--line)',
};

const modalDateStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-.01em',
  color: 'var(--ink)',
};

const modalSubStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--ink-mute)',
  marginTop: '2px',
};

const modalCloseBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: 'none',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  fontSize: '14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const modalBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 20px 28px',
};

const modalInsightBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  background: 'var(--accent-tint)',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '18px',
};

const modalSummaryStyle: CSSProperties = {
  margin: 0,
  fontSize: '13.5px',
  color: 'var(--ink)',
  lineHeight: 1.6,
};

const chatColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const bubbleBaseStyle: CSSProperties = {
  maxWidth: '80%',
  padding: '10px 13px',
  borderRadius: '14px',
  fontSize: '13.5px',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const userBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  background: 'var(--accent)',
  color: '#fff',
  borderBottomRightRadius: '4px',
};

const aiBubbleStyle: CSSProperties = {
  ...bubbleBaseStyle,
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
  borderBottomLeftRadius: '4px',
};

const modalEmptyStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '13px',
  color: 'var(--ink-mute)',
  padding: '32px 0',
};
