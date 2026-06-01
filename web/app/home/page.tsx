'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FeedbackSheet } from '@/components/FeedbackSheet';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import OnboardingRedirectModal from '@/components/OnboardingRedirectModal';
import { TabBar } from '@/components/ui/TabBar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { calculateCurrentWeek } from '@/lib/utils/week';

// ────────────────────────────────────────────────────────────
// 11 홈 — 12주 코칭 대시보드 (스펙 v1.2)
//
// 구성 (스펙 3번):
//   3.1 상단바  3.2 인사  3.3 커리어 방향 카드  3.4 오늘의 액션
//   3.5 메모 유도 카드  3.6 12주 타임라인  3.7 탭바
// ────────────────────────────────────────────────────────────

interface ActiveGoal {
  id: string;
  goal_title: string;
  /** v1.5: started_at 기준 계산된 현재 주차 (DB값 무시) */
  current_week: number;
  competency_code: string;
  started_at: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  strength_link?: string | null;
}

interface CoachingInsight {
  week_number: number;
  next_action_title: string | null;
  strength_link: string | null;
  badge: string | null;
  comment: string | null;
}

interface UserStrength {
  name_ko: string;
  name_en: string;
  domain: string;
  rank?: number;
}

interface HomeData {
  nickname: string;
  goal: ActiveGoal;
  currentAction: ActionItem | null;
  strengths: UserStrength[];
  insights: CoachingInsight[];
  /** 미래 주차에 코칭이 이미 정해둔 액션 (week_number → title) */
  futureActionsByWeek: Map<number, string>;
}

const TOTAL_WEEKS = 12;
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────

function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 월요일을 한 주의 시작으로 (한국 관례)
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen text="홈을 준비하고 있어요..." />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const { ready, pendingRedirect, confirmRedirect } = useOnboardingGuard('complete');

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // 피드백 모달 — 첫 홈 랜딩 시 1회만
  const [showFeedback, setShowFeedback] = useState(false);

  const handleFeedbackClose = () => {
    try { localStorage.setItem('home_feedback_prompted', '1'); } catch { /* ignore */ }
    setShowFeedback(false);
  };

  // 이번 주 월~일 7일
  const today = new Date();
  const monday = startOfWeekMonday(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // ── 데이터 로드 ───────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1차: profile, goal, strengths 병렬
        const [profileRes, goalRes, strengthRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('goals')
            .select('id, goal_title, current_week, competency_code, started_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('strength_analyses')
            .select('strengths')
            .eq('user_id', user.id)
            .eq('is_latest', true)
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (profileRes.error) console.error('[11] profiles:', profileRes.error);
        if (goalRes.error) console.error('[11] goals:', goalRes.error);
        if (strengthRes.error) console.error('[11] strength_analyses:', strengthRes.error);

        if (!goalRes.data) {
          // active goal 없음 → 액션 아이템 단계로
          router.replace('/onboarding/action-items');
          return;
        }
        // v1.5: DB의 current_week 무시하고 started_at 기준 캘린더 계산
        const goalRow = goalRes.data as ActiveGoal;
        const currentWeek = calculateCurrentWeek(goalRow.started_at);
        const goal: ActiveGoal = { ...goalRow, current_week: currentWeek };

        // 2차 fetch: action_items(현재 주차) + insights(과거) + future actions(미래 주차) 병렬
        const mondayISO = formatLocalISO(monday);
        const sundayISO = formatLocalISO(addDays(monday, 6));

        const [actionRes, insightRes, futureActionRes] = await Promise.all([
          supabase
            .from('action_items')
            // v0.8: strength_link 컬럼 사용 — 오늘의 액션 카드 "강점 「○○」을 발휘하는 시간" 표시
            .select('id, title, strength_link')
            .eq('user_id', user.id)
            .eq('goal_id', goal.id)
            .eq('week_number', currentWeek)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('coaching_insights')
            .select('week_number, next_action_title, strength_link, badge, comment')
            .eq('user_id', user.id)
            .eq('goal_id', goal.id)
            .lt('week_number', currentWeek)
            .order('week_number', { ascending: true }),
          // v1.6: 코칭이 이미 정해둔 미래 주차 액션 가져오기 → 타임라인 future 카드에 표시
          supabase
            .from('action_items')
            .select('week_number, title')
            .eq('user_id', user.id)
            .eq('goal_id', goal.id)
            .gt('week_number', currentWeek)
            .lte('week_number', TOTAL_WEEKS)
            .order('week_number', { ascending: true })
            .order('created_at', { ascending: false }), // 같은 주차 중복 시 최신 우선
        ]);

        if (cancelled) return;

        const logErr = (label: string, err: { message?: string; details?: string; code?: string; hint?: string } | null) => {
          if (!err) return;
          console.error(`[11] ${label}:`, err.message || '(no message)', '| code:', err.code, '| details:', err.details, '| hint:', err.hint);
        };
        logErr('action_items', actionRes.error);
        logErr('coaching_insights', insightRes.error);
        logErr('action_items (future)', futureActionRes.error);

        if (!actionRes.data) {
          // 현재 주차 action_items 없음 → 진입 조건 위반
          router.replace('/onboarding/action-items');
          return;
        }

        // 3차 fetch: action_completions를 **현재 주차 action_item.id로 필터**
        // (BUGFIX: 코칭으로 W1→W2 전환 후 같은 주 안에서 W1 액션의 체크가
        //  W2 그리드에 잘못 표시되던 문제 해결)
        const currentActionId = actionRes.data.id as string;
        const completionRes = await supabase
          .from('action_completions')
          .select('completed_date')
          .eq('user_id', user.id)
          .eq('action_item_id', currentActionId)
          .gte('completed_date', mondayISO)
          .lte('completed_date', sundayISO);

        if (cancelled) return;
        logErr('action_completions', completionRes.error);

        // 미래 주차 액션 맵 만들기 (같은 주차에 여러 row면 최신 created_at 우선)
        const futureActionsByWeek = new Map<number, string>();
        (futureActionRes.data ?? []).forEach((row: { week_number: number; title: string }) => {
          if (!futureActionsByWeek.has(row.week_number)) {
            futureActionsByWeek.set(row.week_number, row.title);
          }
        });

        setData({
          nickname: profileRes.data?.nickname ?? '',
          goal,
          currentAction: actionRes.data as ActionItem,
          strengths: (strengthRes.data?.strengths as UserStrength[] | undefined) ?? [],
          insights: (insightRes.data as CoachingInsight[] | undefined) ?? [],
          futureActionsByWeek,
        });

        const dates = new Set<string>();
        (completionRes.data ?? []).forEach((c: { completed_date: string }) => {
          if (c.completed_date) dates.add(c.completed_date);
        });
        setCompletedDates(dates);
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('홈 데이터를 불러올 수 없어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router]);

  // 데이터 로드 완료 후 피드백 모달 1회 표시 (홈이 먼저 보인 뒤 슬라이드업)
  useEffect(() => {
    if (!data) return;
    try {
      if (!localStorage.getItem('home_feedback_prompted')) {
        const timer = setTimeout(() => setShowFeedback(true), 800);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, [data]);

  // ── 오늘/특정 날짜 완료 토글 ───────────────────────────────
  // 미래 날짜만 차단. 오늘·과거 다 체크 가능.
  // 낙관적 업데이트 후 롤백 안 함 — schema 미비 시에도 UI는 작동, DB 에러는 콘솔에만.
  const handleToggleDay = useCallback(
    async (date: Date) => {
      if (!data || !data.currentAction) return;
      // 미래 날짜만 차단 (오늘·과거 모두 허용)
      const todayOnly = new Date(today);
      todayOnly.setHours(0, 0, 0, 0);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly.getTime() > todayOnly.getTime()) return;

      const dateISO = formatLocalISO(date);
      const wasCompleted = completedDates.has(dateISO);

      // 낙관적 업데이트 (즉시 UI 반영, 롤백 없음)
      setCompletedDates((prev) => {
        const next = new Set(prev);
        if (wasCompleted) next.delete(dateISO);
        else next.add(dateISO);
        return next;
      });

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // schema 정합: action_completions는 (user_id, action_item_id, completed_date) UNIQUE.
        // 현재 주차 action_item.id를 FK로 사용 (NOT NULL 제약).
        const actionItemId = data.currentAction.id;

        if (wasCompleted) {
          const { error: delErr } = await supabase
            .from('action_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('action_item_id', actionItemId)
            .eq('completed_date', dateISO);
          if (delErr) console.error('[11] action_completions DELETE error:', delErr);
        } else {
          const { error: insErr } = await supabase.from('action_completions').insert({
            user_id: user.id,
            action_item_id: actionItemId,
            completed_date: dateISO,
          });
          if (insErr) console.error('[11] action_completions INSERT error:', insErr);
        }
      } catch (e) {
        console.error('[11] toggle error:', e);
      }
    },
    [data, completedDates, today],
  );

  // ── 렌더 분기 ─────────────────────────────────────────────
  // 온보딩 미완료 → 홈 레이아웃 유지하면서 빈 카드로 안내
  if (pendingRedirect) return (
    <div style={wrapStyle}>
      <header style={topbarStyle}>
        <div style={brandStyle}>CareerPT<sup style={brandDotStyle}>·</sup></div>
        <span style={stepPillStyle}>홈</span>
      </header>
      <main style={screenStyle}>
        {/* 인사 영역 */}
        <section style={greetingStyle}>
          <div style={greetingTitleStyle}>안녕하세요 👋</div>
          <div style={greetingSubStyle}>코칭을 시작하면 여기에 현황이 표시돼요</div>
        </section>

        {/* 커리어 방향 카드 (빈 상태) */}
        <div style={{ ...themeCardStyle, display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.75, letterSpacing: '.06em' }}>
            커리어 방향
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.4, opacity: 0.55 }}>
            목표를 설정하면 여기에 표시돼요
          </div>
          <div style={{
            marginTop: '4px', height: '1px',
            background: 'rgba(255,255,255,0.2)',
          }} />
          <div style={{ fontSize: '13px', opacity: 0.6, fontWeight: 500 }}>
            온보딩을 완료하고 시작해보세요 ✨
          </div>
        </div>

        {/* 오늘의 액션 카드 (빈 상태) */}
        <div style={{
          border: '1.5px dashed var(--border)', borderRadius: '18px',
          padding: '20px', marginBottom: '20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px' }}>📋</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            오늘의 액션
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            액션 아이템을 선택하면<br />매일 여기서 확인할 수 있어요
          </div>
        </div>

        {/* 이어서 하기 CTA */}
        <button
          onClick={confirmRedirect}
          style={{
            width: '100%', minHeight: '50px', borderRadius: '14px', border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: '15px', fontWeight: 800, letterSpacing: '-.02em',
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(45,91,255,.28)',
          }}
        >
          온보딩 이어서 하기 →
        </button>
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          {pendingRedirect.title}
        </p>
      </main>
      <TabBar active="home" />
    </div>
  );
  if (!ready || loading) return <LoadingScreen text="홈을 준비하고 있어요..." />;
  if (!data) return <LoadingScreen text={error ?? '데이터를 찾을 수 없어요.'} />;

  const todayISO = formatLocalISO(today);
  const todayCompleted = completedDates.has(todayISO);

  // 이번 주 doneCount (월~일)
  const doneCountWeek = weekDays.filter((d) =>
    completedDates.has(formatLocalISO(d)),
  ).length;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 — 회고 페이지와 동일한 sticky 헤더 */}
      <header style={topbarStyle}>
        <div style={brandStyle}>
          CareerPT
          <sup style={brandDotStyle}>·</sup>
        </div>
        <span style={stepPillStyle}>홈</span>
      </header>

      {/* 본문 (스크롤) */}
      <main style={screenStyle}>
        {/* 인사 영역 */}
        <section style={greetingStyle}>
          <div style={greetingTitleStyle}>
            안녕하세요,{' '}
            {data.nickname ? (
              <em style={greetingNameStyle}>{data.nickname}님</em>
            ) : (
              '친구님'
            )}
          </div>
          <div style={greetingSubStyle}>
            {WEEKDAY_KO[today.getDay()]}요일 · {today.getMonth() + 1}월 {today.getDate()}일 ·{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {data.goal.current_week}주차
            </strong>{' '}
            진행 중 ✨
          </div>
        </section>

        {/* 커리어 방향 카드 (3.3) */}
        <ThemeCard goal={data.goal} />

        {/* 오늘의 액션 카드 (3.4) */}
        <TodayCard
          action={data.currentAction}
          todayCompleted={todayCompleted}
          doneCountWeek={doneCountWeek}
          weekDays={weekDays}
          today={today}
          completedDates={completedDates}
          onToggleDay={handleToggleDay}
        />

        {/* 메모 유도 카드 (3.5) */}
        <MemoNotif onGoReflect={() => router.push('/reflect')} />

        {/* 12주 타임라인 (3.6) */}
        <h2 style={timelineTitleStyle}>🗺️ 12주의 여정</h2>
        <Timeline
          goal={data.goal}
          insights={data.insights}
          currentAction={data.currentAction}
          futureActionsByWeek={data.futureActionsByWeek}
          weekDays={weekDays}
          today={today}
          completedDates={completedDates}
          onToggleDay={handleToggleDay}
        />

        <div style={{ height: '12px' }} />
      </main>

      {/* 탭바 — main 밖, 항상 하단 고정 */}
      <TabBar active="home" />

      <FeedbackSheet
        open={showFeedback}
        onClose={handleFeedbackClose}
        onSubmitted={handleFeedbackClose}
        source="home_modal"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트 — Theme Card (커리어 방향 그라데이션 카드)
// ────────────────────────────────────────────────────────────

function ThemeCard({ goal }: { goal: ActiveGoal }) {
  const progressPct = Math.round((goal.current_week / TOTAL_WEEKS) * 100);

  return (
    <div style={themeCardStyle}>
      <div aria-hidden="true" style={themeDecorTopRight} />
      <div aria-hidden="true" style={themeDecorBottomRight} />

      <div style={themeLabel}>나의 커리어 방향</div>
      <h3 style={themeTitle}>{`"${goal.goal_title}"`}</h3>

      {/* 진행률 행 */}
      <div style={themeProgRow}>
        <span style={themeProgBadge}>
          {goal.current_week}주차 / {TOTAL_WEEKS}주
        </span>
        <div style={themeProgBar}>
          <div style={{ ...themeProgFill, width: `${progressPct}%` }} />
        </div>
        <span style={themeProgPct}>{progressPct}%</span>
      </div>

      {/* 주차 도트 트랙 */}
      <div style={weeksTrack} role="list" aria-label="12주 진행 도트">
        {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
          const week = i + 1;
          const status =
            week < goal.current_week ? 'done' : week === goal.current_week ? 'current' : 'future';
          return (
            <span
              key={week}
              role="listitem"
              aria-label={`${week}주차 ${status === 'done' ? '완료' : status === 'current' ? '진행 중' : '예정'}`}
              style={{
                ...weekDot,
                ...(status === 'done' ? weekDotDone : {}),
                ...(status === 'current' ? weekDotCurrent : {}),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트 — Today Card (오늘의 액션 + 7일 그리드)
// ────────────────────────────────────────────────────────────

function TodayCard({
  action,
  todayCompleted,
  doneCountWeek,
  weekDays,
  today,
  completedDates,
  onToggleDay,
}: {
  action: ActionItem | null;
  todayCompleted: boolean;
  doneCountWeek: number;
  weekDays: Date[];
  today: Date;
  completedDates: Set<string>;
  onToggleDay: (date: Date) => void;
}) {
  return (
    <div style={todayCardStyle}>
      <div style={todayHeaderStyle}>
        <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>
          ⭐ 오늘의 액션 · {WEEKDAY_KO[today.getDay()]}요일
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
          이번 주 {doneCountWeek}/7
        </span>
      </div>

      <div style={todayActionTextStyle}>{action?.title ?? '액션이 설정되지 않았어요'}</div>

      {/* 7일 그리드 */}
      <div style={todaysGridStyle}>
        {weekDays.map((day) => {
          const dayISO = formatLocalISO(day);
          const isCompleted = completedDates.has(dayISO);
          const isToday = isSameDay(day, today);
          const isFuture = day.getTime() > today.getTime() && !isToday;

          const dayStyle: CSSProperties = {
            ...tcDayStyle,
            ...(isCompleted ? tcDayFilledStyle : {}),
            ...(isToday ? tcDayTodayStyle : {}),
            ...(isFuture ? tcDayFutureStyle : {}),
          };

          return (
            <button
              key={dayISO}
              type="button"
              onClick={() => onToggleDay(day)}
              disabled={isFuture}
              style={dayStyle}
              aria-label={`${WEEKDAY_KO[day.getDay()]}요일 ${day.getDate()}일 ${isCompleted ? '완료' : '미완료'}`}
            >
              <span style={{ fontSize: '9px', letterSpacing: '.08em' }}>
                {WEEKDAY_KO[day.getDay()]}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                {isCompleted ? '✓' : day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* 체크 안내 메시지 */}
      <div
        style={{
          marginTop: '10px',
          fontSize: '12px',
          color: todayCompleted ? 'var(--accent)' : 'var(--text-muted)',
          fontWeight: todayCompleted ? 700 : 500,
          textAlign: 'center',
        }}
        aria-live="polite"
      >
        {todayCompleted ? '🎉 오늘 완료했어요!' : '실행한 요일에 체크해주세요'}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트 — Memo Notif (메모 유도 카드)
// ────────────────────────────────────────────────────────────

function MemoNotif({ onGoReflect }: { onGoReflect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onGoReflect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onGoReflect();
        }
      }}
      style={notifStyle}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div aria-hidden="true" style={{ fontSize: '22px', flexShrink: 0, lineHeight: 1.2 }}>
          💌
        </div>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>
          <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 600 }}>
            오늘의 메모, 짧게라도 남겨볼까요?
          </strong>
          주말에 코치와 마감 회고를 할 때 컨텍스트가 돼요.
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onGoReflect();
        }}
        style={notifBtnStyle}
      >
        회고하기 →
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트 — Timeline (12주 여정)
// ────────────────────────────────────────────────────────────

function Timeline({
  goal,
  insights,
  currentAction,
  futureActionsByWeek,
  weekDays,
  today,
  completedDates,
  onToggleDay,
}: {
  goal: ActiveGoal;
  insights: CoachingInsight[];
  currentAction: ActionItem | null;
  futureActionsByWeek: Map<number, string>;
  weekDays: Date[];
  today: Date;
  completedDates: Set<string>;
  onToggleDay: (d: Date) => void;
}) {
  const insightByWeek = new Map(insights.map((i) => [i.week_number, i]));

  return (
    <div style={timelineWrapStyle}>
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
        const week = i + 1;
        if (week < goal.current_week) {
          // done
          const ins = insightByWeek.get(week);
          return <TimelineDone key={week} week={week} insight={ins} />;
        }
        if (week === goal.current_week) {
          return (
            <TimelineCurrent
              key={week}
              week={week}
              action={currentAction}
              weekDays={weekDays}
              today={today}
              completedDates={completedDates}
              onToggleDay={onToggleDay}
            />
          );
        }
        return (
          <TimelineFuture
            key={week}
            week={week}
            plannedActionTitle={futureActionsByWeek.get(week) ?? null}
          />
        );
      })}
    </div>
  );
}

function TimelineDone({
  week,
  insight,
}: {
  week: number;
  insight: CoachingInsight | undefined;
}) {
  const hasInsight = !!insight && (!!insight.next_action_title || !!insight.comment);
  return (
    <div style={tlItemStyle}>
      <div style={tlLeftCol}>
        <div style={{ ...tlDot, ...tlDotDone }}>{week}</div>
      </div>
      <div style={{ ...tlCard, ...tlCardDone }}>
        {hasInsight ? (
          <>
            <div style={tlStatusDone}>
              완료
              {insight?.badge ? ` · ${insight.badge}` : ''}
              {insight?.comment ? ` ${insight.comment}` : ''}
            </div>
            {insight?.next_action_title && (
              <div style={tlActionTitleDone}>{insight.next_action_title}</div>
            )}
            {insight?.strength_link && (
              <span style={strengthMiniStyle}>강점 「{insight.strength_link}」</span>
            )}
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            회고 미완료
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCurrent({
  week,
  action,
  weekDays,
  today,
  completedDates,
  onToggleDay,
}: {
  week: number;
  action: ActionItem | null;
  weekDays: Date[];
  today: Date;
  completedDates: Set<string>;
  onToggleDay: (d: Date) => void;
}) {
  const doneCount = weekDays.filter((d) => completedDates.has(formatLocalISO(d))).length;
  return (
    <div style={tlItemStyle}>
      <div style={tlLeftCol}>
        <div style={{ ...tlDot, ...tlDotCurrent }}>{week}</div>
      </div>
      <div style={{ ...tlCard, ...tlCardCurrent }}>
        <div style={tlStatusCurrent}>이번 주 · 진행 중 ({doneCount}/7)</div>
        <div style={tlActionTitleCurrent}>{action?.title ?? '액션이 없어요'}</div>

      </div>
    </div>
  );
}

function TimelineFuture({
  week,
  plannedActionTitle,
}: {
  week: number;
  plannedActionTitle?: string | null;
}) {
  // v1.6: 코칭이 이미 정해둔 액션이 있으면 제목 표시. 없으면 기본 안내.
  return (
    <div style={tlItemStyle}>
      <div style={tlLeftCol}>
        <div style={{ ...tlDot, ...tlDotFuture }}>{week}</div>
      </div>
      <div style={{ ...tlCard, ...tlCardFuture }}>
        {plannedActionTitle ? (
          <>
            <div style={tlPlannedLabel}>📋 코치와 정한 액션</div>
            <div style={tlPlannedTitle}>{plannedActionTitle}</div>
          </>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            코치와 함께 정해요
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  height: '100dvh',        // minHeight → height: 화면 높이 고정
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',      // 내부 main이 스크롤, wrapper는 고정
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
  border: 'none',
  borderRadius: '999px',
  background: 'var(--accent-tint)',
  fontWeight: 700,
};

const screenStyle: CSSProperties = {
  padding: '8px 22px 24px',
  flex: 1,
  overflowY: 'auto',
  // TabBar는 wrapper flex 맨 아래 고정 → main이 남은 공간 전부 차지하며 스크롤
};

const greetingStyle: CSSProperties = {
  padding: '8px 0 22px',
};

const greetingTitleStyle: CSSProperties = {
  fontSize: '24px',
  fontWeight: 800,
  letterSpacing: '-.02em',
  lineHeight: 1.3,
  color: 'var(--text-primary)',
};

const greetingNameStyle: CSSProperties = {
  fontStyle: 'normal',
  color: 'var(--accent)',
  fontWeight: 800,
};

const greetingSubStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted)',
  marginTop: '6px',
  fontWeight: 500,
};

// Theme card (3.3)
const themeCardStyle: CSSProperties = {
  // 14 프로필 히어로 카드와 동일한 solid accent 색
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: '20px',
  padding: '22px 22px 20px',
  marginBottom: '16px',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 6px 20px -8px rgba(45,91,255,.4)',
};

const themeDecorTopRight: CSSProperties = {
  position: 'absolute',
  top: '-20px',
  right: '-20px',
  width: '130px',
  height: '130px',
  background: 'rgba(255,255,255,.07)',
  borderRadius: '50%',
  pointerEvents: 'none',
};

const themeDecorBottomRight: CSSProperties = {
  position: 'absolute',
  bottom: '-40px',
  right: '40px',
  width: '80px',
  height: '80px',
  background: 'rgba(255,255,255,.04)',
  borderRadius: '50%',
  pointerEvents: 'none',
};

const themeLabel: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '.12em',
  opacity: 0.65,
  marginBottom: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  position: 'relative',
};

const themeTitle: CSSProperties = {
  fontWeight: 800,
  fontSize: '20px',
  margin: '0 0 18px',
  letterSpacing: '-.02em',
  lineHeight: 1.35,
  position: 'relative',
};

const themeProgRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginTop: '14px',
  position: 'relative',
};

const themeProgBadge: CSSProperties = {
  background: 'rgba(255,255,255,.18)',
  borderRadius: '999px',
  padding: '4px 12px',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const themeProgBar: CSSProperties = {
  flex: 1,
  height: '5px',
  background: 'rgba(255,255,255,.2)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const themeProgFill: CSSProperties = {
  height: '100%',
  borderRadius: '3px',
  background: 'rgba(255,255,255,.85)',
  transition: 'width .5s ease',
};

const themeProgPct: CSSProperties = {
  fontSize: '12px',
  opacity: 0.7,
  flexShrink: 0,
};

const weeksTrack: CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginTop: '12px',
  position: 'relative',
};

const weekDot: CSSProperties = {
  flex: 1,
  height: '4px',
  background: 'rgba(255,255,255,.18)',
  borderRadius: '2px',
};

const weekDotDone: CSSProperties = {
  background: 'rgba(255,255,255,.85)',
};

const weekDotCurrent: CSSProperties = {
  background: '#fbbf24',
  boxShadow: '0 0 0 2px rgba(251,191,36,.3)',
};

// Today card (3.4)
const todayCardStyle: CSSProperties = {
  background: 'var(--accent-tint)',
  border: '2px solid var(--accent)',
  borderRadius: '18px',
  padding: '18px',
  marginBottom: '14px',
};

const todayHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '10px',
};

const todayActionTextStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 500,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
  marginBottom: '14px',
  letterSpacing: '-.01em',
};


const todaysGridStyle: CSSProperties = {
  display: 'flex',
  gap: '5px',
  marginTop: '12px',
};

const tcDayStyle: CSSProperties = {
  flex: 1,
  height: '36px',
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '9px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  letterSpacing: '.08em',
  transition: 'all .2s',
  fontWeight: 500,
  fontFamily: 'inherit',
  padding: 0,
};

const tcDayFilledStyle: CSSProperties = {
  background: 'var(--accent-soft)',
  borderColor: 'var(--accent-soft)',
  color: 'var(--accent-deep)',
};

const tcDayTodayStyle: CSSProperties = {
  background: '#fff',
  borderColor: 'var(--accent)',
  color: 'var(--accent)',
};

const tcDayFutureStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

// Memo Notif (3.5)
const notifStyle: CSSProperties = {
  background: '#fef9e7',
  border: '1px solid #fde68a',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  cursor: 'pointer',
};

const notifBtnStyle: CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
};

// Timeline (3.6)
const timelineTitleStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '14px',
  marginTop: '24px',
  letterSpacing: '-.01em',
};

const timelineWrapStyle: CSSProperties = {
  position: 'relative',
};

const tlItemStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '56px 1fr',
  gap: '14px',
  paddingBottom: '14px',
};

const tlLeftCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
};

const tlDot: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  background: 'var(--bg-soft)',
  border: '1px solid var(--line-strong)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-muted)',
};

const tlDotDone: CSSProperties = {
  background: 'var(--accent-soft)',
  borderColor: 'var(--accent)',
  color: 'var(--accent-deep)',
  fontWeight: 700,
};

const tlDotCurrent: CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  borderColor: 'var(--accent)',
  width: '38px',
  height: '38px',
  boxShadow: '0 0 0 4px var(--accent-tint)',
  fontWeight: 700,
};

const tlDotFuture: CSSProperties = {
  background: '#fff',
  borderStyle: 'dashed',
  color: 'var(--text-muted)',
};

const tlWeekLabel: CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  letterSpacing: '.04em',
};

const tlCard: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: '14px',
  padding: '14px',
};

const tlCardDone: CSSProperties = {
  background: 'var(--bg-soft)',
};

const tlCardCurrent: CSSProperties = {
  background: 'var(--accent-tint)',
  border: '1.5px solid var(--accent)',
  boxShadow: '0 4px 14px -6px rgba(45,91,255,.18)',
};

const tlCardFuture: CSSProperties = {
  background: 'transparent',
  border: '1px dashed var(--line-strong)',
};

// v1.6: 코칭이 이미 정해둔 미래 액션 표시용 (TimelineFuture 안)
const tlPlannedLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--accent)',
  marginBottom: '4px',
  letterSpacing: '.02em',
};

const tlPlannedTitle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
};

const tlStatusDone: CSSProperties = {
  color: 'var(--accent-deep)',
  fontSize: '11px',
  fontWeight: 700,
  marginBottom: '6px',
};

const tlStatusCurrent: CSSProperties = {
  color: 'var(--accent)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: '8px',
};

const tlActionTitleDone: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '6px',
  lineHeight: 1.4,
};

const tlActionTitleCurrent: CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
  color: 'var(--text-primary)',
  marginBottom: '10px',
  lineHeight: 1.4,
};

const strengthMiniStyle: CSSProperties = {
  display: 'inline-block',
  background: 'var(--accent-soft)',
  color: 'var(--accent-deep)',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: '999px',
};

const tlDayRow: CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginTop: '8px',
};

const tlDayStyle: CSSProperties = {
  flex: 1,
  height: '24px',
  borderRadius: '6px',
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  fontWeight: 500,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};

const tlDayFilledStyle: CSSProperties = {
  background: 'var(--accent-soft)',
  borderColor: 'var(--accent-soft)',
  color: 'var(--accent-deep)',
};

const tlDayTodayStyle: CSSProperties = {
  background: '#fff',
  borderColor: 'var(--accent)',
  color: 'var(--accent)',
};

const tlDayFutureStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

