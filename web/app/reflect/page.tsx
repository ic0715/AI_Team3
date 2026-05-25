'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import { TabBar } from '@/components/ui/TabBar';
import { calculateCurrentWeek } from '@/lib/utils/week';

// ────────────────────────────────────────────────────────────
// 12 회고 — 단일 회고 화면 (스펙 v1.5)
//
// 매일 동일한 화면. 평일/주말 분기 없음.
// 구성: 데일리 메모(다중 누적, schema v0.8) + AI 코치 CTA 카드 (항상 노출)
// v1.5: 주간 회고 입력 영역 제거. weekly_retros 저장 없이도
//        AI 코치와 다음 주 액션 정하기 진입 가능.
// ────────────────────────────────────────────────────────────

interface ActiveGoal {
  id: string;
  /** v1.5: started_at 기준 계산된 현재 주차 */
  current_week: number;
  started_at: string | null;
}

// 데일리 메모 — schema v0.8 다중 누적 정책 (UNIQUE 제거)
interface DailyMemo {
  id?: string;
  memo_date: string;        // YYYY-MM-DD
  content: string;
  created_at?: string;       // 시간 정렬용
}

const WEEKDAY_KO_FULL = ['일', '월', '화', '수', '목', '금', '토'];

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────

function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function ReflectPage() {
  return (
    <Suspense fallback={<LoadingScreen text="회고 데이터를 불러오는 중..." />}>
      <ReflectContent />
    </Suspense>
  );
}

function ReflectContent() {
  const router = useRouter();
  const { ready } = useOnboardingGuard('complete');

  const [goal, setGoal] = useState<ActiveGoal | null>(null);
  const [actionTitle, setActionTitle] = useState<string>('');
  const [doneCountWeek, setDoneCountWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데일리 메모 (v1.4 — 매일 다중 누적 + 리스트 표시)
  const [memos, setMemos] = useState<DailyMemo[]>([]);
  const [memoText, setMemoText] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);

  // v1.5: 주간 회고 입력 영역 제거 — weekly_retros 저장 없이도
  // AI 코치 CTA를 항상 노출. weekly_retros 관련 state/handler 모두 삭제.

  const today = new Date();
  const monday = startOfWeekMonday(today);
  const sundayISO = formatLocalISO(addDays(monday, 6));
  const mondayISO = formatLocalISO(monday);

  // ── 데이터 로드 ────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const goalRes = await supabase
          .from('goals')
          // v1.5: started_at 포함 — 주차 계산에 사용
          .select('id, current_week, started_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!goalRes.data) {
          router.replace('/onboarding/action-items');
          return;
        }
        // v1.5: DB의 current_week 무시하고 started_at 기준 계산
        const goalRow = goalRes.data as ActiveGoal;
        const g: ActiveGoal = { ...goalRow, current_week: calculateCurrentWeek(goalRow.started_at) };
        setGoal(g);

        // 2차 fetch: action_items + memos 병렬 (둘 다 action_item_id에 의존하지 않음)
        const [actionRes, memoRes] = await Promise.all([
          supabase
            .from('action_items')
            // id 포함 — action_completions 조회 FK로 사용
            .select('id, title')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .eq('week_number', g.current_week)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          // 이번 주 데일리 메모 (v1.4 — 다중 누적, schema v0.8)
          // 정렬: memo_date 오름차순, 동일 날 created_at 오름차순 (시간 순)
          supabase
            .from('daily_memos')
            .select('id, memo_date, content, created_at')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .gte('memo_date', mondayISO)
            .lte('memo_date', sundayISO)
            .order('memo_date', { ascending: true })
            .order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;

        if (actionRes.error) console.error('[12] action_items:', actionRes.error);
        if (memoRes.error) console.error('[12] daily_memos:', memoRes.error);

        setActionTitle(actionRes.data?.title ?? '액션이 설정되지 않았어요');
        setMemos((memoRes.data ?? []) as DailyMemo[]);

        // 3차 fetch: action_completions를 **현재 주차 action_item.id로 필터**
        // (BUGFIX: 코칭으로 W1→W2 전환 후 같은 주 안의 W1 체크가 잘못 집계되던 문제 해결)
        const currentActionId = actionRes.data?.id as string | undefined;
        if (currentActionId) {
          const completionRes = await supabase
            .from('action_completions')
            .select('completed_date')
            .eq('user_id', user.id)
            .eq('action_item_id', currentActionId)
            .gte('completed_date', mondayISO)
            .lte('completed_date', sundayISO);

          if (cancelled) return;
          if (completionRes.error) console.error('[12] action_completions:', completionRes.error);
          setDoneCountWeek((completionRes.data ?? []).length);
        } else {
          // 현재 주차 action_item 없음 → 카운트 0
          setDoneCountWeek(0);
        }

        // v1.5: weekly_retros 로드 제거 — 회고 입력 영역 자체가 없어졌으므로
        // 기존 회고 프리필 / retroSaved 동기화 로직 모두 불필요

        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('회고 데이터를 불러올 수 없어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router]);

  // ── 데일리 메모 저장 (v1.4 — 다중 누적, schema v0.8) ──────
  const handleSaveMemo = useCallback(async () => {
    if (!goal || savingMemo) return;
    const trimmed = memoText.trim();
    if (!trimmed) return;

    setSavingMemo(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const todayISO = formatLocalISO(today);
      const { data: inserted, error: insErr } = await supabase
        .from('daily_memos')
        .insert({
          user_id: user.id,
          goal_id: goal.id,
          memo_date: todayISO,
          week_number: goal.current_week,
          content: trimmed,
        })
        .select('id, memo_date, content, created_at')
        .maybeSingle();
      if (insErr) throw insErr;

      // 로컬 리스트에 즉시 append (낙관적 + 응답 데이터로 정확화)
      const nowISO = new Date().toISOString();
      const newMemo: DailyMemo = inserted ?? {
        memo_date: todayISO,
        content: trimmed,
        created_at: nowISO,
      };
      setMemos((prev) => {
        const next = [...prev, newMemo];
        next.sort((a, b) => {
          const dateDiff = a.memo_date.localeCompare(b.memo_date);
          if (dateDiff !== 0) return dateDiff;
          return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        });
        return next;
      });
      setMemoText('');
    } catch (e) {
      console.error('[12] save memo:', e);
      const err = e as { message?: string };
      const detail = err?.message ? ` (${err.message})` : '';
      setError(`메모 저장에 실패했어요. 다시 시도해주세요.${detail}`);
    } finally {
      setSavingMemo(false);
    }
  }, [goal, memoText, savingMemo, today]);

  // v1.5: handleSaveRetro 제거 — 주간 회고 입력 영역 자체가 없어짐.
  // weekly_retros INSERT 없이도 AI 코치 CTA 진입 가능 (13 페이지의 weekly_retros 의존성은 nullable로 처리됨).

  // ── 렌더 분기 ─────────────────────────────────────────────
  if (!ready || loading) return <LoadingScreen text="회고를 준비하고 있어요..." />;
  if (!goal) return <LoadingScreen text={error ?? '활성 목표가 없어요.'} />;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={topbarStyle}>
        <div style={brandStyle}>
          CareerPT
          <sup style={brandDotStyle}>·</sup>
        </div>
        <span style={stepPillStyle}>회고</span>
      </header>

      <main style={screenStyle}>
        <ReflectScreen
          goal={goal}
          actionTitle={actionTitle}
          doneCountWeek={doneCountWeek}
          memos={memos}
          memoText={memoText}
          setMemoText={setMemoText}
          savingMemo={savingMemo}
          onSaveMemo={handleSaveMemo}
          onGoCoach={() => router.push('/reflect/coach')}
          today={today}
          error={error}
        />
      </main>

      <TabBar active="reflect" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 회고 단일 화면 (v1.5 — 데일리 메모(다중) + AI 코치 CTA 항상 노출)
// 주간 회고 입력 영역 제거됨 (v1.4 → v1.5).
// ────────────────────────────────────────────────────────────

function ReflectScreen({
  goal,
  actionTitle,
  doneCountWeek,
  memos,
  memoText,
  setMemoText,
  savingMemo,
  onSaveMemo,
  onGoCoach,
  today,
  error,
}: {
  goal: ActiveGoal;
  actionTitle: string;
  doneCountWeek: number;
  memos: DailyMemo[];
  memoText: string;
  setMemoText: (v: string) => void;
  savingMemo: boolean;
  onSaveMemo: () => void;
  onGoCoach: () => void;
  today: Date;
  error: string | null;
}) {
  return (
    <div>
      <div style={subtitleStyle}>
        Week {goal.current_week} 회고 · {WEEKDAY_KO_FULL[today.getDay()]}요일
      </div>
      <h1 style={titleStyle}>
        한 주를 <em style={emAccent}>돌아봐요</em> 🌙
      </h1>

      {/* 안내 문구 */}
      <div style={noticeCardStyle}>
        <div style={noticeHeaderStyle}>
          💡 오늘의 느낌을 짧게 기록하고, 다음 주는 AI 코치와 함께 정해요
        </div>
        <div style={noticeBodyStyle}>
          오늘 액션을 실행하면서 느낀 점을 메모로 남겨두세요. 한 주를 마무리할
          때쯤 AI 코치와 다음 주 액션을 정해보세요.
        </div>
      </div>

      {/* 이번 주 액션 요약 카드 */}
      <div style={weeklyActionCardStyle}>
        <div style={actionLabelStyle}>이번 주 액션</div>
        <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '10px', lineHeight: 1.4 }}>
          {actionTitle}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={statChipBg}>목표 7회</span>
          <span style={statChipAccent}>실제 {doneCountWeek}회</span>
        </div>
      </div>

      {/* 데일리 메모 입력 (다중 누적) */}
      <div style={{ marginBottom: '6px' }}>
        <label style={formLabelStyle}>오늘의 메모</label>
        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          placeholder="예: 오늘은 30분 읽고 3줄 메모 남김."
          rows={3}
          style={{ ...textareaStyle, minHeight: '80px' }}
        />
      </div>

      <button
        type="button"
        onClick={onSaveMemo}
        disabled={savingMemo || !memoText.trim()}
        style={{
          ...inkBtnStyle,
          opacity: savingMemo || !memoText.trim() ? 0.5 : 1,
          cursor: savingMemo || !memoText.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {savingMemo ? '저장 중...' : '메모 저장'}
      </button>

      {/* 이번 주 메모 리스트 (1개 이상일 때만) */}
      {memos.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div style={memoSectionTitleStyle}>이번 주 메모 · {memos.length}개</div>
          <div>
            {memos.map((m, idx) => (
              <MemoRow key={m.id ?? `${m.memo_date}-${idx}`} memo={m} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={errorAlertStyle}>
          {error}
        </div>
      )}

      {/* AI 코치 CTA 카드 (v1.5 — 회고 저장 조건 제거, 항상 노출) */}
      <div style={{ marginTop: '28px' }}>
        <div style={dividerLineStyle} aria-hidden="true" />
        <div style={ctaLabelStyle}>다음 주 준비</div>
        <button
          type="button"
          onClick={onGoCoach}
          style={coachCtaCardStyle}
          aria-label="AI 코치와 다음 주 액션 정하기"
        >
          <div style={coachIconStyle}>🤖</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
              AI 코치와 다음 주 액션 정하기
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
              이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요. (주말 시행 권장)
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={tagAccentTintStyle}>✦ 강점 기반 추천</span>
              <span style={tagBgSoftStyle}>약 3–5분 소요</span>
            </div>
          </div>
          <span style={{ fontSize: '20px', color: 'var(--accent)' }}>›</span>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메모 row (이번 주 메모 리스트 아이템)
// ────────────────────────────────────────────────────────────

function MemoRow({ memo }: { memo: DailyMemo }) {
  const date = new Date(memo.memo_date);
  const created = memo.created_at ? new Date(memo.created_at) : null;
  const timeStr = created
    ? `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`
    : '';
  return (
    <div style={memoRowStyle}>
      <div style={memoDayColStyle}>
        <div style={memoDayLabelStyle}>{WEEKDAY_KO_FULL[date.getDay()]}</div>
        <div style={memoDateStyle}>
          {date.getMonth() + 1}.{date.getDate()}
        </div>
        {timeStr && (
          <div style={{ ...memoDateStyle, fontSize: '8.5px', marginTop: '1px' }}>
            {timeStr}
          </div>
        )}
      </div>
      <div style={memoContentStyle}>{memo.content}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// LoadingScreen
// ────────────────────────────────────────────────────────────

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
  marginBottom: '12px',
  color: 'var(--ink)',
};

const titleStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 800,
  letterSpacing: '-.035em',
  lineHeight: 1.25,
  margin: '0 0 14px',
  color: 'var(--ink)',
};

const emAccent: CSSProperties = {
  fontStyle: 'normal',
  color: 'var(--accent)',
};

const noticeCardStyle: CSSProperties = {
  background: 'var(--accent-tint)',
  borderLeft: '3px solid var(--accent)',
  borderRadius: '0 10px 10px 0',
  padding: '12px 14px',
  marginBottom: '20px',
};

const noticeHeaderStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--accent)',
  marginBottom: '4px',
};

const noticeBodyStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
};

const actionLabelStyle: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '.1em',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: 500,
};

const formLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
  marginBottom: '6px',
  fontWeight: 500,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
  fontSize: '15px',
  fontFamily: 'inherit',
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
  resize: 'vertical',
  minHeight: '100px',
  lineHeight: 1.55,
};

const inkBtnStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'opacity .15s',
};

// 데일리 메모 리스트 스타일 (v1.4)
const memoSectionTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '10px',
  color: 'var(--ink)',
};

const memoRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px 1fr',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid var(--line)',
};

const memoDayColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const memoDayLabelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--accent)',
};

const memoDateStyle: CSSProperties = {
  fontSize: '9px',
  color: 'var(--ink-mute)',
  marginTop: '2px',
};

const memoContentStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--ink)',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
};

const errorAlertStyle: CSSProperties = {
  marginTop: '12px',
  padding: '10px 14px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

const weeklyActionCardStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '18px',
};

const statChipBg: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '4px 10px',
  background: 'var(--bg)',
  color: 'var(--ink-soft)',
  borderRadius: '999px',
};

const statChipAccent: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 10px',
  background: 'var(--accent-tint)',
  color: 'var(--accent)',
  borderRadius: '999px',
};

const dividerLineStyle: CSSProperties = {
  borderTop: '1px solid var(--line)',
  marginBottom: '14px',
};

const ctaLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--ink-mute)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: '10px',
};

const coachCtaCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  background: '#fff',
  border: '1.5px solid var(--line-strong)',
  borderRadius: '18px',
  padding: '16px',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'border-color .15s',
};

const coachIconStyle: CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  background: 'var(--accent-tint)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '22px',
  flexShrink: 0,
};

const tagAccentTintStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 9px',
  background: 'var(--accent-tint)',
  color: 'var(--accent)',
  borderRadius: '999px',
};

const tagBgSoftStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '3px 9px',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  borderRadius: '999px',
};
