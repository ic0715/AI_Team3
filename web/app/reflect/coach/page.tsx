'use client';

import { useCallback, useEffect, useRef, useState, memo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calculateCurrentWeek } from '@/lib/utils/week';

// ────────────────────────────────────────────────────────────
// 13 회고 AI 코칭 — 채팅 + 다음 주 액션 정하기 (스펙 v1.1)
//
// MVP는 시나리오 기반 정적 플로우 (mock). 추후 Claude API 스트리밍 연동.
// AI 연동 인터페이스는 generatePersonalizedTexts/Actions와 동일 패턴.
// 자세한 인계 내용은 docs/HANDOFF_AI.md (Phase 1.7 신설 예정) 참조.
// ────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 🤖 AI 연동 (06 v1.3)
//
// sendCoachMessage    → POST /api/reflect-coach/chat
// finalizeCoaching    → POST /api/reflect-coach/finalize (AI 추출만) + 클라이언트가 DB INSERT
//
// 구현 기준: docs/ai_prompt/06_reflect_coaching.md
// 품질 기법: Prompt Caching + Temperature 분리 (대화 0.7 / 추출 0) + 🔴 가드레일
// ─────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'coach' | 'user';
  content: string;
}

interface CoachContext {
  nickname: string;
  goal: { id: string; goal_title: string; current_week: number; competency_code: string };
  topStrength: string | null;
  weeklyRetro: string;
  weeklyRetroId: string | null; // v0.8: coaching_insights.weekly_retro_id (FK)
  doneCountWeek: number;
}

// v0.8: 11 홈 12주 타임라인 done 카드의 badge/comment 산출 (완료율 기반)
// 스펙 _post_mvp_v2/11_home.md §6 참조
function computeBadgeAndComment(doneCount: number): { badge: string; comment: string } {
  if (doneCount >= 7) return { badge: '🔥', comment: '완벽한 한 주!' };
  if (doneCount >= 5) return { badge: '👍', comment: '꾸준함이 쌓이고 있어요' };
  if (doneCount >= 3) return { badge: '😊', comment: '절반을 해냈어요' };
  return { badge: '🌱', comment: '다음 주를 기대해요' };
}

interface CoachMessageParams {
  history: Message[];
  context: CoachContext;
  questionIndex: number; // 1~4
  isRenegotiate: boolean;
}

interface CoachMessageResult {
  content: string;
  nextQuestionIndex: number; // 다음 Q index, 4 초과 시 종료
  isComplete: boolean;
}

interface CoachingResult {
  topic: string;
  patternInsight: string;
  nextActionTitle: string;
  strengthLink: string;
}

// ── 🤖 코치 메시지 — POST /api/reflect-coach/chat ───────────────
async function sendCoachMessage(params: CoachMessageParams): Promise<CoachMessageResult> {
  const res = await fetch('/api/reflect-coach/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`reflect-coach/chat ${res.status}: ${errBody}`);
  }
  return res.json();
}

// ── 🤖 종료 시: AI 추출 (서버) + coaching_insights/action_items INSERT (클라이언트) ──
async function finalizeCoaching(
  history: Message[],
  context: CoachContext,
  userId: string,
): Promise<CoachingResult> {
  // 1) AI 추출 (06 §5.2)
  const res = await fetch('/api/reflect-coach/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history, context }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`reflect-coach/finalize ${res.status}: ${errBody}`);
  }
  const ai = (await res.json()) as {
    topic: string;
    pattern_insight: string;
    next_action_title: string;
    next_action_reason: string;
    strength_link: string;
  };

  const result: CoachingResult = {
    topic: ai.topic,
    patternInsight: ai.pattern_insight || `${context.goal.goal_title} — 이번 주 코칭 정리`,
    nextActionTitle: ai.next_action_title,
    strengthLink: ai.strength_link || (context.topStrength ?? ''),
  };

  // 2) v0.8: 완료율 기반 badge/comment (11 홈 타임라인 done 카드용)
  const { badge, comment } = computeBadgeAndComment(context.doneCountWeek);

  const TOTAL_WEEKS = 12;
  const nextWeek = Math.min(context.goal.current_week + 1, TOTAL_WEEKS);

  // ───── 3) coaching_insights — UPSERT 패턴 ─────
  // schema 제약: (user_id, goal_id, week_number) UNIQUE → 같은 주에 다시 코칭하면
  //   UPDATE해야 함 (그냥 INSERT하면 23505 위반).
  // ※ next_action_reason은 main의 AI 응답(ai.next_action_reason)을 우선 사용.
  const insightPayload = {
    weekly_retro_id: context.weeklyRetroId, // v0.8: 연결된 주차 회고 FK
    topic: result.topic,
    pattern_insight: result.patternInsight,
    next_action_title: result.nextActionTitle,
    next_action_reason: ai.next_action_reason || result.patternInsight,
    strength_link: result.strengthLink,
    badge,    // v0.8: 11 홈 타임라인 done 카드 이모지
    comment,  // v0.8: 11 홈 타임라인 done 카드 코멘트
  };

  const { data: existingInsight, error: insightSelectErr } = await supabase
    .from('coaching_insights')
    .select('id')
    .eq('user_id', userId)
    .eq('goal_id', context.goal.id)
    .eq('week_number', context.goal.current_week)
    .maybeSingle();
  if (insightSelectErr) {
    console.error('[13] coaching_insights SELECT:', insightSelectErr);
  }

  if (existingInsight) {
    const { error: updErr } = await supabase
      .from('coaching_insights')
      .update(insightPayload)
      .eq('id', existingInsight.id);
    if (updErr) console.error('[13] coaching_insights UPDATE:', updErr);
  } else {
    const { error: insErr } = await supabase.from('coaching_insights').insert({
      user_id: userId,
      goal_id: context.goal.id,
      week_number: context.goal.current_week,
      ...insightPayload,
    });
    if (insErr) console.error('[13] coaching_insights INSERT:', insErr);
  }

  // ───── 4) action_items (다음 주차) — UPSERT 패턴 ─────
  // 같은 (user_id, goal_id, week_number=nextWeek, is_custom=false) 행이 이미 있으면
  // UPDATE (사용자가 마음 바뀌어 코칭 다시 받음 → 다음 주 액션 덮어쓰기).
  // 없으면 INSERT (첫 코칭).
  // ※ id를 유지하므로 action_completions FK 연결도 안전.
  // ※ description은 main의 AI 응답(ai.next_action_reason)을 우선 사용.
  const actionPayload = {
    title: result.nextActionTitle,
    description: ai.next_action_reason || result.patternInsight,
    tags: [],
    is_custom: false,
    source_seed_id: null,
    strength_link: result.strengthLink, // v0.8: top 강점명 (자유 텍스트)
  };

  // 가장 최근 created_at row를 UPDATE 대상으로 (11 home의 future fetch 정렬과 일치).
  // 같은 주차에 중복 row가 이미 있는 경우 화면에 보이는 것과 동일한 row를 갱신해야
  // 사용자에게 "업데이트됐다"가 즉시 인지됨.
  const { data: existingAction, error: actionSelectErr } = await supabase
    .from('action_items')
    .select('id')
    .eq('user_id', userId)
    .eq('goal_id', context.goal.id)
    .eq('week_number', nextWeek)
    .eq('is_custom', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (actionSelectErr) {
    console.error('[13] action_items SELECT:', actionSelectErr);
  }

  if (existingAction) {
    const { error: updErr } = await supabase
      .from('action_items')
      .update(actionPayload)
      .eq('id', existingAction.id);
    if (updErr) console.error('[13] action_items UPDATE:', updErr);
  } else {
    const { error: insErr } = await supabase.from('action_items').insert({
      user_id: userId,
      goal_id: context.goal.id,
      week_number: nextWeek,
      ...actionPayload,
    });
    if (insErr) console.error('[13] action_items INSERT:', insErr);
  }

  // v1.5: goals.current_week UPDATE 제거.
  // 주차는 항상 started_at 기준 날짜 계산으로 결정되므로 DB값 변경 불필요.

  return result;
}
// ─────────────────────────────────────────────────────────────

const CONFIRM_WORDS = ['확정', '좋아요', '네', '응', '맞아', 'OK', 'ok', '괜찮', '이걸로'];

function isConfirmation(text: string): boolean {
  const t = text.trim();
  return CONFIRM_WORDS.some((w) => t.includes(w));
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function CoachPage() {
  return (
    <Suspense fallback={<LoadingScreen text="코치를 준비하고 있어요..." />}>
      <CoachContent />
    </Suspense>
  );
}

function CoachContent() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [questionIndex, setQuestionIndex] = useState(1); // 1~4
  const [isComplete, setIsComplete] = useState(false);
  const [isRenegotiate, setIsRenegotiate] = useState(false);
  // v1.6: 코치가 종료를 알렸지만 아직 finalize(추출·저장) 전 상태.
  //   true면 입력창 대신 '회고 완료하기' 버튼을 노출 — 사용자가 대화를 다시 보고 눌러야 진행.
  //   (커리어 manual-finalize PR #107 패턴 이식. 자동 finalize 폐기.)
  const [readyToFinalize, setReadyToFinalize] = useState(false);

  // v1.7: input state는 자식 MessageInput 컴포넌트로 이동 (typing lag fix)
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [summary, setSummary] = useState<CoachingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── 컨텍스트 로드 + 첫 코치 메시지 ────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (cancelled) return;
        setUserId(user.id);

        // 1차: profile + goal(+started_at) + strengths
        const [profileRes, goalRes, strengthRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('goals')
            // v1.5: started_at 포함 — 주차 계산에 사용
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
        if (!goalRes.data) {
          router.replace('/onboarding/action-items');
          return;
        }

        const goalRow = goalRes.data as { id: string; goal_title: string; current_week: number; competency_code: string; started_at: string | null };
        // v1.5: started_at 기준 캘린더 날짜로 주차 계산 (DB의 current_week 무시)
        const calculatedWeek = calculateCurrentWeek(goalRow.started_at);
        const goal: CoachContext['goal'] = {
          id: goalRow.id,
          goal_title: goalRow.goal_title,
          current_week: calculatedWeek,
          competency_code: goalRow.competency_code,
        };

        // 2차: 현재 주차 action_item + weekly_retros 병렬
        const [actionItemRes, retroRes] = await Promise.all([
          supabase
            .from('action_items')
            .select('id')
            .eq('user_id', user.id)
            .eq('goal_id', goal.id)
            .eq('week_number', calculatedWeek)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('weekly_retros')
            // v0.8: id 포함 — coaching_insights.weekly_retro_id (FK) 저장용
            .select('id, summary_one_line, completion_count, target_count')
            .eq('user_id', user.id)
            .eq('goal_id', goal.id)
            .eq('week_number', calculatedWeek)
            .order('retro_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        // ⚠️ 테스트용 — production 복구 필요
        // 원래 동작: weekly_retros 미저장이면 /reflect로 리다이렉트
        // if (!retroRes.data) {
        //   router.replace('/reflect');
        //   return;
        // }

        // 3차: action_completions를 action_item_id로 필터 (이번 주 완료 카운트)
        let doneFromCompletions = 0;
        if (actionItemRes.data?.id) {
          const completionRes = await supabase
            .from('action_completions')
            .select('completed_date')
            .eq('user_id', user.id)
            .eq('action_item_id', actionItemRes.data.id as string);
          if (cancelled) return;
          doneFromCompletions = (completionRes.data ?? []).length;
        }

        const strengths = (strengthRes.data?.strengths as Array<{ name_ko: string }> | undefined) ?? [];
        const ctx: CoachContext = {
          nickname: profileRes.data?.nickname ?? '친구',
          goal,
          topStrength: strengths[0]?.name_ko ?? null,
          weeklyRetro: retroRes.data?.summary_one_line ?? '',
          weeklyRetroId: (retroRes.data?.id as string | undefined) ?? null,
          doneCountWeek:
            (retroRes.data?.completion_count as number | undefined) ??
            doneFromCompletions,
        };
        setContext(ctx);

        // 첫 코치 메시지 (위클리 회고 없으면 인용 라인 생략)
        const retroQuote = ctx.weeklyRetro ? `\n\n"${ctx.weeklyRetro}"` : '';
        const openingMessage: Message = {
          id: crypto.randomUUID(),
          role: 'coach',
          content: `안녕하세요, ${ctx.nickname}님 🌱\nWeek ${calculatedWeek} 회고 잘 봤어요.${retroQuote}\n\n잠깐 함께 들여다볼까요? 가장 인상 깊었던 한 가지는 뭐였어요?`,
        };
        setMessages([openingMessage]);
        setLoadingContext(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setContextError('컨텍스트를 불러올 수 없어요.');
          setLoadingContext(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  // 스크롤 자동 따라가기
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ── 메시지 전송 ───────────────────────────────────────────
  // v1.7(2026-05-25): typing lag fix를 위해 input state를 자식 MessageInput으로 분리.
  //   handleSend는 text 인자를 받는 형태로 변경. 부모는 input 변경 시마다 재렌더링되지
  //   않으므로 한글 IME composition이 안 깨짐.
  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !context || !userId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const inputCopy = trimmed;
    setIsSending(true);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      // 재협의 모드에서 확정어 감지 → 요약 재표시
      if (isRenegotiate && isConfirmation(inputCopy)) {
        await new Promise((r) => setTimeout(r, 900));
        setIsRenegotiate(false);
        setIsComplete(true);
        setIsSending(false);
        // 요약은 이미 있음 (summary state 유지)
        return;
      }

      const response = await sendCoachMessage({
        history: nextMessages,
        context,
        questionIndex,
        isRenegotiate,
      });

      const coachMessage: Message = {
        id: crypto.randomUUID(),
        role: 'coach',
        content: response.content,
      };
      setMessages((prev) => [...prev, coachMessage]);
      setQuestionIndex(response.nextQuestionIndex);

      if (response.isComplete && !isRenegotiate) {
        // v1.6: 자동 finalize 폐기 — 코치 종료 발화 후 '회고 완료하기' 버튼을 노출하고,
        //   사용자가 직접 눌렀을 때만 추출·저장 진행 (handleFinalize).
        //   재협의 확정 경로(위 isConfirmation 분기)는 이 흐름을 타지 않음.
        setReadyToFinalize(true);
      }
    } catch (e) {
      console.error('[13] send:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'coach',
          content: '잠시 연결이 불안정해요. 다시 시도해주세요.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, context, userId, messages, questionIndex, isRenegotiate]);

  // ── 회고 완료하기 (사용자가 직접 누름) → 추출·저장 → 요약 화면 ──
  // v1.6: 자동 finalize를 대체. 중복 클릭 가드(isFinalizing), 실패 시 readyToFinalize
  //   유지하여 재시도 가능, 성공 시에만 해제하고 요약(summary) 노출.
  const handleFinalize = useCallback(async () => {
    if (!context || !userId || isFinalizing) return;
    setError(null);
    setIsFinalizing(true);
    try {
      const result = await finalizeCoaching(messages, context, userId);
      setSummary(result);
      setIsComplete(true);
      setReadyToFinalize(false);
    } catch (e) {
      console.error('[13] finalize:', e);
      setError('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsFinalizing(false);
    }
  }, [context, userId, messages, isFinalizing]);

  // ── 재협의 시작 ───────────────────────────────────────────
  const handleRenegotiate = useCallback(() => {
    setIsRenegotiate(true);
    setIsComplete(false);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'coach',
        content:
          '어떤 액션이 더 잘 맞을 것 같아요? 자유롭게 말씀해주세요. 마음에 드는 액션을 발견하면 "좋아요"나 "이걸로"라고 알려주세요.',
      },
    ]);
  }, []);

  // ── 분기 렌더 ────────────────────────────────────────────
  if (loadingContext) return <LoadingScreen text="코치를 준비하고 있어요..." />;
  if (!context) return <LoadingScreen text={contextError ?? '컨텍스트가 없어요.'} />;

  const showSummary = isComplete && !!summary && !isRenegotiate;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 — ← + 중앙 타이틀 (08 인터뷰 스타일) */}
      <header style={topbarStyle}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          style={backBtnStyle}
        >
          ←
        </button>
        <span style={topbarTitleStyle}>다음 주 액션 정하기</span>
        <span style={{ width: '40px' }} />
      </header>


      {/* 채팅 영역 또는 요약 화면 */}
      {showSummary ? (
        <SummarySection
          summary={summary!}
          onRenegotiate={handleRenegotiate}
          onGoHome={() => router.push('/home')}
        />
      ) : (
        <>
          <div style={chatScrollStyle}>
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}

            {(isSending || isFinalizing) && <TypingIndicator />}

            {error && (
              <div role="alert" style={errorAlertStyle}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 또는 완료 버튼 — v1.6: 코치 종료 후엔 '회고 완료하기' 버튼으로 교체 */}
          {!isFinalizing && (
            readyToFinalize ? (
              <FinalizeBar onFinalize={handleFinalize} />
            ) : (
              <MessageInput onSend={handleSend} isSending={isSending} />
            )
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────────────────

/**
 * 메시지 입력창 (v1.7 — 2026-05-25 신설)
 *
 * input state를 부모(CoachContent)에서 분리한 이유:
 *  - 부모는 messages 배열·AI fetch 상태 등 큰 state를 가짐
 *  - 매 keystroke마다 부모 전체가 재렌더링되면 한글 IME composition이
 *    깨져서 "한 글자씩 끊김" 증상 발생
 *  - input을 자식의 로컬 state로 두고 React.memo로 감싸면, 부모의 messages
 *    변경에 영향받지 않고 textarea만 가볍게 재렌더링
 *
 * 한글 IME 안전 처리:
 *  - onCompositionStart/End로 조합 중인지 추적
 *  - Enter로 전송할 때 composition 중이면 무시 (한글 조합 마지막 Enter가
 *    의도와 다르게 전송 트리거하는 것 방지)
 */
const MessageInput = memo(function MessageInput({
  onSend,
  isSending,
}: {
  onSend: (text: string) => void;
  isSending: boolean;
}) {
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setInput('');
  };

  const canSubmit = !!input.trim() && !isSending;

  return (
    <div style={inputAreaStyle}>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(e) => {
          // 한글 조합 중 Enter 무시 (IME 안전)
          if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="답변을 입력해주세요"
        rows={1}
        style={inputTextareaStyle}
        aria-label="코치에게 답변 입력"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        style={{
          ...sendBtnStyle,
          opacity: canSubmit ? 1 : 0.4,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
        aria-label="메시지 전송"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 19-7z" />
        </svg>
      </button>
    </div>
  );
});

// 완료 버튼 바 (v1.6) — 코치 종료 후 입력창 자리에 노출.
//   누르면 handleFinalize 실행(추출·저장 → 요약). 누르기 전까진 위로 스크롤해 대화 재확인 가능.
function FinalizeBar({ onFinalize }: { onFinalize: () => void }) {
  return (
    <div style={finalizeBarStyle}>
      <button type="button" onClick={onFinalize} style={finalizeBtnStyle}>
        회고 완료하기 →
      </button>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  if (isUser) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'msgIn .35s ease',
        }}
      >
        <div style={userBubbleStyle}>{msg.content}</div>
      </div>
    );
  }
  // 코치 메시지: 말풍선 + 하단 [아바타 + 방금]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        animation: 'msgIn .35s ease',
      }}
    >
      <div style={coachBubbleStyle}>{msg.content}</div>
      <div style={msgFooterStyle}>
        <CoachAvatar />
        <span style={msgTimeStyle}>방금</span>
      </div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <span aria-hidden="true" style={avatarStyle}>
      🤖
    </span>
  );
}

function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ ...coachBubbleStyle, color: 'var(--text-muted)', fontSize: '13px' }}>
        입력 중<span style={dotAnim}>...</span>
      </div>
      <div style={msgFooterStyle}>
        <CoachAvatar />
        <span style={msgTimeStyle}>방금</span>
      </div>
    </div>
  );
}

function SummarySection({
  summary,
  onRenegotiate,
  onGoHome,
}: {
  summary: CoachingResult;
  onRenegotiate: () => void;
  onGoHome: () => void;
}) {
  return (
    <div style={summaryWrapStyle}>
      {/* 인사이트 카드 */}
      <div style={insightCardStyle}>
        <div style={insightLabelStyle}>📌 이번 주 패턴</div>
        <div style={insightContentStyle}>{summary.patternInsight}</div>

        <div style={{ ...insightLabelStyle, marginTop: '14px' }}>🎯 다음 주 액션 아이템</div>
        <div style={nextActionBoxStyle}>{summary.nextActionTitle}</div>

        <span style={strengthLinkPillStyle}>강점 「{summary.strengthLink}」</span>
      </div>

      {/* 안내 메시지 */}
      <div style={summaryNoticeStyle}>
        ✅ 다음 주 액션이 저장됐어요. 홈에서 새 액션을 확인해보세요.
      </div>

      {/* 액션 버튼 행 */}
      <div style={summaryActionsStyle}>
        <button type="button" onClick={onRenegotiate} style={summaryBtnSecondaryStyle}>
          추가로 더 이야기하기
        </button>
        <button type="button" onClick={onGoHome} style={summaryBtnPrimaryStyle}>
          홈에서 확인하기
        </button>
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
  minHeight: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflowX: 'hidden',
  position: 'relative',
};

const topbarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  display: 'grid',
  gridTemplateColumns: '40px 1fr 40px',
  alignItems: 'center',
  padding: '14px 20px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
};

const backBtnStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '22px',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  textAlign: 'left',
  padding: 0,
};

const topbarTitleStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 800,
  color: 'var(--ink)',
  textAlign: 'center',
  letterSpacing: '-.02em',
};

const chatScrollStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px 20px 12px',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
};

// 코치 말풍선 — 회색 배경, 보더 없음, 통일 둥근 모서리
const coachBubbleStyle: CSSProperties = {
  maxWidth: '85%',
  padding: '14px 18px',
  fontSize: '15px',
  lineHeight: 1.6,
  background: 'var(--bg-soft)',
  borderRadius: '16px',
  color: 'var(--text-primary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

// 메시지 하단 푸터 (아바타 + 방금)
const msgFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginTop: '6px',
  marginLeft: '4px',
};

const avatarStyle: CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  background: 'var(--accent-tint)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '15px',
  flexShrink: 0,
};

const msgTimeStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: 500,
};

const userBubbleStyle: CSSProperties = {
  maxWidth: '78%',
  padding: '14px 18px',
  fontSize: '15px',
  lineHeight: 1.6,
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: '16px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const dotAnim: CSSProperties = {
  display: 'inline-block',
  marginLeft: '2px',
};

// 입력 영역 — pill 스타일 + 원형 전송 버튼
const inputAreaStyle: CSSProperties = {
  padding: '12px 16px',
  paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  background: 'var(--surface)',
  borderTop: '1px solid var(--line)',
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  flexShrink: 0,
};

const inputTextareaStyle: CSSProperties = {
  flex: 1,
  resize: 'none',
  fontSize: '15px',
  padding: '11px 18px',
  borderRadius: '999px',
  border: '1.5px solid var(--line)',
  background: 'var(--bg-soft)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
  lineHeight: 1.5,
  minHeight: '44px',
  maxHeight: '120px',
};

const sendBtnStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  background: 'var(--accent)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'opacity .2s',
  boxShadow: '0 2px 8px -2px rgba(45,91,255,.4)',
};

// 완료 버튼 바 (v1.6) — inputArea와 동일한 하단 영역 레이아웃
const finalizeBarStyle: CSSProperties = {
  padding: '14px 16px',
  paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
  background: 'var(--surface)',
  borderTop: '1px solid var(--line)',
  flexShrink: 0,
};

const finalizeBtnStyle: CSSProperties = {
  width: '100%',
  padding: '15px',
  borderRadius: '14px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '15px',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(45,91,255,.3)',
};

const errorAlertStyle: CSSProperties = {
  padding: '10px 14px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

// Summary
const summaryWrapStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const insightCardStyle: CSSProperties = {
  background: 'var(--accent-tint)',
  border: '1.5px solid var(--accent)',
  borderRadius: '18px',
  padding: '18px',
};

const insightLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--accent)',
  marginBottom: '8px',
};

const insightContentStyle: CSSProperties = {
  fontSize: '14px',
  color: 'var(--ink)',
  lineHeight: 1.65,
};

const nextActionBoxStyle: CSSProperties = {
  background: '#fff',
  border: '1.5px solid var(--accent-soft)',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--ink)',
  lineHeight: 1.4,
  marginBottom: '12px',
};

const strengthLinkPillStyle: CSSProperties = {
  display: 'inline-block',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
};

const summaryNoticeStyle: CSSProperties = {
  background: '#fef9e7',
  border: '1px solid #fde68a',
  borderRadius: '14px',
  padding: '12px 16px',
  fontSize: '13px',
  color: 'var(--ink)',
  lineHeight: 1.6,
};

const summaryActionsStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '4px',
  paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
};

const summaryBtnSecondaryStyle: CSSProperties = {
  flex: 1,
  padding: '14px 8px',
  borderRadius: '14px',
  border: '1px solid var(--line-strong)',
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '13.5px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-.02em',
};

const summaryBtnPrimaryStyle: CSSProperties = {
  flex: 1,
  padding: '14px',
  borderRadius: '14px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-.02em',
};
