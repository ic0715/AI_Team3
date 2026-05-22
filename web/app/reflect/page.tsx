'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import { TabBar } from '@/components/ui/TabBar';

// ────────────────────────────────────────────────────────────
// 12 회고 — 데일리 메모 / 위클리 회고 (스펙 v1.2)
//
// 평일(월~금) → 데일리 모드 (daily_memos UPSERT)
// 주말(토~일) → 위클리 모드 (weekly_retros INSERT + AI 코치 CTA 카드 노출)
// ────────────────────────────────────────────────────────────

interface ActiveGoal {
  id: string;
  current_week: number;
}

interface DailyMemo {
  id?: string;
  memo_date: string; // YYYY-MM-DD
  content: string;
  created_at?: string; // 누적 정렬용
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

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// 메모 정렬용: 월~일 순서로
function dayOrderKey(dateISO: string): number {
  const d = new Date(dateISO).getDay();
  return d === 0 ? 7 : d; // 일=7로 끝에
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
  const [memos, setMemos] = useState<DailyMemo[]>([]);
  const [doneCountWeek, setDoneCountWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데일리 모드 상태
  const [memoText, setMemoText] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);

  // 위클리 모드 상태
  const [retroText, setRetroText] = useState('');
  const [savingRetro, setSavingRetro] = useState(false);
  const [retroSaved, setRetroSaved] = useState(false);

  const today = new Date();
  const isWeeklyMode = isWeekend(today);
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
          .select('id, current_week')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!goalRes.data) {
          router.replace('/onboarding/action-items');
          return;
        }
        const g = goalRes.data as ActiveGoal;
        setGoal(g);

        const [actionRes, memoRes, completionRes] = await Promise.all([
          supabase
            .from('action_items')
            .select('title')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .eq('week_number', g.current_week)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('daily_memos')
            .select('id, memo_date, content, created_at')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .gte('memo_date', mondayISO)
            .lte('memo_date', sundayISO)
            .order('created_at', { ascending: true }),
          supabase
            .from('action_completions')
            .select('completed_date')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .gte('completed_date', mondayISO)
            .lte('completed_date', sundayISO),
        ]);

        if (cancelled) return;

        if (actionRes.error) console.error('[12] action_items:', actionRes.error);
        if (memoRes.error) console.error('[12] daily_memos:', memoRes.error);
        if (completionRes.error) console.error('[12] action_completions:', completionRes.error);

        setActionTitle(actionRes.data?.title ?? '액션이 설정되지 않았어요');

        // 메모 정렬: 요일 순(월→일) 우선, 같은 날은 created_at 오름차순
        const memoList = (memoRes.data ?? []) as DailyMemo[];
        memoList.sort((a, b) => {
          const dayDiff = dayOrderKey(a.memo_date) - dayOrderKey(b.memo_date);
          if (dayDiff !== 0) return dayDiff;
          return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        });
        setMemos(memoList);

        // 매번 빈 textarea로 시작 (누적 모드 — 프리필 제거)
        setMemoText('');

        setDoneCountWeek((completionRes.data ?? []).length);
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

  // ── 데일리 메모 저장 (누적) ───────────────────────────────
  const handleSaveMemo = useCallback(async () => {
    if (!goal || savingMemo) return;
    const trimmed = memoText.trim();
    if (!trimmed) return;

    setSavingMemo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const todayISO = formatLocalISO(today);
      const nowISO = new Date().toISOString();

      // INSERT — 같은 날에도 여러 메모 누적
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

      // 로컬 상태에 새 메모 append
      const newMemo: DailyMemo = inserted ?? {
        memo_date: todayISO,
        content: trimmed,
        created_at: nowISO,
      };
      setMemos((prev) => {
        const next = [...prev, newMemo];
        next.sort((a, b) => {
          const dayDiff = dayOrderKey(a.memo_date) - dayOrderKey(b.memo_date);
          if (dayDiff !== 0) return dayDiff;
          return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        });
        return next;
      });
      setMemoText('');
    } catch (e) {
      console.error('[12] save memo:', e);
      setError('메모 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSavingMemo(false);
    }
  }, [goal, memoText, savingMemo, today]);

  // ── 위클리 회고 저장 ──────────────────────────────────────
  const handleSaveRetro = useCallback(async () => {
    if (!goal || savingRetro) return;
    const trimmed = retroText.trim();
    if (!trimmed) return;

    setSavingRetro(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const todayISO = formatLocalISO(today);
      const { error: insErr } = await supabase
        .from('weekly_retros')
        .insert({
          user_id: user.id,
          goal_id: goal.id,
          week_number: goal.current_week,
          retro_date: todayISO,
          summary_one_line: trimmed,
          completion_count: doneCountWeek,
          target_count: 7,
        });
      if (insErr) throw insErr;

      // 저장 완료 표시 + CTA 노출
      setRetroSaved(true);
    } catch (e) {
      console.error('[12] save retro:', e);
      setError('회고 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSavingRetro(false);
    }
  }, [goal, retroText, savingRetro, today, doneCountWeek]);

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
        {isWeeklyMode ? (
          <WeeklyMode
            goal={goal}
            actionTitle={actionTitle}
            memos={memos}
            doneCountWeek={doneCountWeek}
            retroText={retroText}
            setRetroText={setRetroText}
            savingRetro={savingRetro}
            retroSaved={retroSaved}
            onSaveRetro={handleSaveRetro}
            onGoCoach={() => router.push('/reflect/coach')}
            today={today}
            error={error}
          />
        ) : (
          <DailyMode
            actionTitle={actionTitle}
            memos={memos}
            memoText={memoText}
            setMemoText={setMemoText}
            savingMemo={savingMemo}
            onSaveMemo={handleSaveMemo}
            today={today}
            error={error}
          />
        )}
      </main>

      <TabBar active="reflect" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 데일리 모드 (평일)
// ────────────────────────────────────────────────────────────

function DailyMode({
  actionTitle,
  memos,
  memoText,
  setMemoText,
  savingMemo,
  onSaveMemo,
  today,
  error,
}: {
  actionTitle: string;
  memos: DailyMemo[];
  memoText: string;
  setMemoText: (v: string) => void;
  savingMemo: boolean;
  onSaveMemo: () => void;
  today: Date;
  error: string | null;
}) {
  return (
    <div>
      <div style={subtitleStyle}>
        매일의 메모 · {WEEKDAY_KO_FULL[today.getDay()]}요일
      </div>
      <h1 style={titleStyle}>
        오늘은 <em style={emAccent}>어땠어요?</em> 🌱
      </h1>

      {/* 안내 문구 카드 */}
      <div style={noticeCardStyle}>
        <div style={noticeHeaderStyle}>💡 오늘 기록이 주말 회고의 재료가 돼요</div>
        <div style={noticeBodyStyle}>
          오늘 액션을 실행하면서 어떤 느낌이었는지 짧게 기록해두세요. 잘 됐든 안
          됐든, 솔직한 한 줄이면 충분해요.
        </div>
      </div>

      {/* 이번 주 액션 표시 */}
      <div style={actionBoxStyle}>
        <div style={actionLabelStyle}>이번 주 액션</div>
        <div style={actionTextStyle}>{actionTitle}</div>
      </div>

      {/* 메모 입력 */}
      <div style={{ marginBottom: '6px' }}>
        <label style={formLabelStyle}>오늘의 메모</label>
        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          placeholder="예: 오늘은 30분 읽고 3줄 메모 남김."
          rows={4}
          style={textareaStyle}
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

      {error && (
        <div role="alert" style={errorAlertStyle}>
          {error}
        </div>
      )}

      {/* 이번 주 메모 리스트 */}
      {memos.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div style={memoSectionTitleStyle}>이번 주 메모 · {memos.length}개</div>
          <div>
            {memos.map((m) => (
              <MemoRow key={m.memo_date} memo={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
// 위클리 모드 (주말)
// ────────────────────────────────────────────────────────────

function WeeklyMode({
  goal,
  actionTitle,
  memos,
  doneCountWeek,
  retroText,
  setRetroText,
  savingRetro,
  retroSaved,
  onSaveRetro,
  onGoCoach,
  today,
  error,
}: {
  goal: ActiveGoal;
  actionTitle: string;
  memos: DailyMemo[];
  doneCountWeek: number;
  retroText: string;
  setRetroText: (v: string) => void;
  savingRetro: boolean;
  retroSaved: boolean;
  onSaveRetro: () => void;
  onGoCoach: () => void;
  today: Date;
  error: string | null;
}) {
  return (
    <div>
      <div style={subtitleStyle}>
        Week {goal.current_week} 위클리 회고 · {WEEKDAY_KO_FULL[today.getDay()]}요일
      </div>
      <h1 style={titleStyle}>
        한 주를 <em style={emAccent}>마감해요</em> 🌙
      </h1>

      {/* 안내 문구 */}
      <div style={noticeCardStyle}>
        <div style={noticeHeaderStyle}>
          💡 이번 주를 돌아보고, 다음 주 액션도 함께 정해요
        </div>
        <div style={noticeBodyStyle}>
          잘 됐든 안 됐든, 그 이유를 들여다보는 것이 다음 주를 바꿔요. 평일 메모를
          참고해서 한 주를 솔직하게 돌아보고, 다음 주에 이어갈 액션까지 정해보세요.
        </div>
      </div>

      {/* 이번 주 평일 메모 요약 */}
      <div style={weeklyMemoSummaryStyle}>
        <div style={weeklyMemoLabelStyle}>✏️ 이번 주 메모</div>
        {memos.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--ink-mute)', lineHeight: 1.55 }}>
            평일 메모가 없어요. 데일리 회고 탭에서 기록해보세요.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {memos.map((m) => (
                <WeeklyMemoRow key={m.memo_date} memo={m} />
              ))}
            </div>
            <div style={weeklyMemoCountStyle}>총 {memos.length}개의 메모</div>
          </>
        )}
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

      {/* 위클리 회고 입력 */}
      <div style={{ marginBottom: '6px' }}>
        <label style={formLabelStyle}>한 주를 한 줄로 표현하면</label>
        <textarea
          value={retroText}
          onChange={(e) => setRetroText(e.target.value)}
          placeholder="예: 야근이 많아서 1번밖에 못했어요."
          rows={3}
          style={{ ...textareaStyle, minHeight: '80px' }}
          disabled={retroSaved}
        />
      </div>

      <button
        type="button"
        onClick={onSaveRetro}
        disabled={savingRetro || !retroText.trim() || retroSaved}
        style={{
          ...accentBtnStyle,
          opacity: savingRetro || !retroText.trim() || retroSaved ? 0.6 : 1,
          cursor:
            savingRetro || !retroText.trim() || retroSaved ? 'not-allowed' : 'pointer',
        }}
      >
        {retroSaved ? '✓ 저장 완료' : savingRetro ? '저장 중...' : '회고 저장하기'}
      </button>

      <div style={retroNoticeStyle}>
        위클리 회고를 저장하면, 다음 주 액션을 AI 코치와 함께 정해볼 수 있어요.
      </div>

      {error && (
        <div role="alert" style={errorAlertStyle}>
          {error}
        </div>
      )}

      {/* AI 코치 CTA 카드 (회고 저장 후 노출) */}
      {retroSaved && (
        <div style={{ marginTop: '20px' }}>
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
                이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요.
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={tagAccentTintStyle}>✦ 강점 기반 추천</span>
                <span style={tagBgSoftStyle}>약 3–5분 소요</span>
              </div>
            </div>
            <span style={{ fontSize: '20px', color: 'var(--accent)' }}>›</span>
          </button>
        </div>
      )}
    </div>
  );
}

function WeeklyMemoRow({ memo }: { memo: DailyMemo }) {
  const d = new Date(memo.memo_date);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <span style={weeklyMemoDayChipStyle}>{WEEKDAY_KO_FULL[d.getDay()]}</span>
      <span style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55, flex: 1 }}>
        {memo.content}
      </span>
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
  width: '390px',
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

const actionBoxStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  border: '1px dashed var(--line-strong)',
  borderRadius: '18px',
  padding: '16px 18px',
  marginBottom: '18px',
};

const actionLabelStyle: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '.1em',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: 500,
};

const actionTextStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: 1.4,
  color: 'var(--ink)',
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

const accentBtnStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'opacity .15s',
  boxShadow: '0 4px 14px -4px rgba(45,91,255,.3)',
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

const memoSectionTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '10px',
  color: 'var(--ink)',
};

const memoRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr',
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
  color: 'var(--accent-deep)',
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

const weeklyMemoSummaryStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '14px',
};

const weeklyMemoLabelStyle: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '.08em',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  marginBottom: '10px',
  fontWeight: 700,
};

const weeklyMemoDayChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '999px',
  flexShrink: 0,
  marginTop: '2px',
};

const weeklyMemoCountStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '11px',
  color: 'var(--ink-mute)',
  textAlign: 'right',
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

const retroNoticeStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '12px',
  color: 'var(--ink-mute)',
  textAlign: 'center',
  lineHeight: 1.55,
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
