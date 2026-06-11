'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { CareerInterviewKeyInsights, SessionDurationChoice } from '@/lib/types/database';
import {
  buildRunningStatePrefix,
  classifySessionDuration,
  detectCoachClosing,
  detectCrisisRed,
  detectUserExit,
  inferPhase,
  type Phase,
  type SessionDurationLabel,
} from '@/lib/constants/career-interview';

// ─────────────────────────────────────────────────────────────
// AI 연동 인터페이스 (v2 자유 흐름)
//   sendMessageToAI: /api/career-interview/chat 호출, messages+context 전송
//   finalizeInterview: /api/career-interview/finalize 호출 후 DB INSERT
// ─────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  /** AI 전송용 본문. user 메시지는 `<현재_상태>` 블록 prefix가 붙어 있음 */
  content: string;
  /** UI 렌더링용 본문 (prefix 없는 원본). 없으면 content 그대로 표시 */
  displayContent?: string;
  timestamp: Date;
}

export interface UserContext {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengths: Array<{ name_ko: string; name_en: string; domain: string }>;
  previousSummary?: string;
}

interface AIChatParams {
  messages: Message[];
  context: UserContext;
}

interface AIResponse {
  content: string;
  isInterviewComplete: boolean;
}

// ── 🤖 AI 연동 함수 (Claude API) ────────────────────────────
async function sendMessageToAI(params: AIChatParams): Promise<AIResponse> {
  // 서버 라우트로 전달 (API 키는 서버에만 존재)
  const payload = {
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    context: params.context,
  };

  const res = await fetch('/api/career-interview/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI chat failed');
  }
  return res.json();
}

// ── 🤖 인터뷰 완료 후 분석 + DB 저장 (Claude API) ───────────
interface FinalizeResult {
  extraction: CareerInterviewKeyInsights;
  session_duration_choice: SessionDurationChoice;
  ai_summary: string;
  interviewId: string;
}

async function finalizeInterview(
  messages: Message[],
  context: UserContext,
  userId: string,
  rowId: string | null,
): Promise<FinalizeResult> {
  // 1) 서버 라우트에서 Claude로 인사이트 추출
  const res = await fetch('/api/career-interview/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      context: { nickname: context.nickname, strengths: context.strengths },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI finalize failed');
  }
  const result = (await res.json()) as FinalizeResult;

  // 2) DB 저장 — in_progress 행이 있으면 UPDATE, 없으면 INSERT(예외 상황 fallback)
  const payload = {
    key_insights: result.extraction,
    session_duration_choice: result.session_duration_choice,
    ai_summary: result.ai_summary,
    conversation_messages: messages.map((m) => ({ role: m.role, content: m.content })),
    status: 'completed',
  };

  let finalId: string;
  if (rowId) {
    const { data: updatedRow, error } = await supabase
      .from('career_interview_results')
      .update(payload)
      .eq('id', rowId)
      .select('id')
      .single();
    if (error) throw error;
    finalId = updatedRow.id;
  } else {
    // rowId 없는 예외 상황 — INSERT fallback
    const { data: insertedRow, error } = await supabase
      .from('career_interview_results')
      .insert({ user_id: userId, ...payload })
      .select('id')
      .single();
    if (error) throw error;
    finalId = insertedRow.id;
  }

  return { ...result, interviewId: finalId };
}
// ─────────────────────────────────────────────────────────────

// ── 첫 AI 메시지 (인터뷰 시작 인사) ─────────────────────────
function buildOpeningMessage(context: UserContext): string {
  const strengthNames = context.strengths.map((s) => s.name_ko).join(', ');
  return `안녕하세요, ${context.nickname}님! 😊\n\n강점(${strengthNames})을 바탕으로 커리어 방향을 함께 찾아볼게요. 편하게 솔직하게 답해주시면 돼요.\n\n오늘 시간은 어느 정도 되세요?`;
}

// ── 세션 저장/복원 (sessionStorage) ─────────────────────────
const SESSION_KEY = 'career_interview_session';

function saveSession(messages: Message[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages }));
  } catch {
    // sessionStorage 실패 시 무시
  }
}

function loadSession(): { messages: Message[] } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // timestamp 복원
    parsed.messages = parsed.messages.map((m: Message) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    return { messages: parsed.messages };
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
function CareerInterviewContent() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [context, setContext] = useState<UserContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  // "인터뷰 종료" 버튼 → 충분히 진행됐을 때의 결과 생성 확인 다이얼로그
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  // 빈/얕은 세션 또는 분석 무효 시: '결과를 만들 수 없음' 안내 후 홈으로
  const [showHomeGuide, setShowHomeGuide] = useState(false);

  // Running State (CONTRACT_v2 §5)
  const [phase, setPhase] = useState<Phase>('opening');
  const [agreedFocus, setAgreedFocus] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<SessionDurationLabel>('medium');

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  // 채팅 전송 실패(자동 재시도 후에도) 여부 → '다시 보내기' 노출
  const [sendError, setSendError] = useState(false);
  // 마지막으로 실패한 턴 보존 (수동 재전송용; 사용자 메시지/입력 손실 방지)
  const pendingTurnRef = useRef<{ msgs: Message[]; meta: { turnCount: number; isCrisis: boolean } } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);      // 전체 컨테이너 (높이 동적 제어)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 세션 복원 여부
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const savedSessionRef = useRef<{ messages: Message[] } | null>(null);

  // DB 행 ID — 인터뷰 시작 시 생성, 중간 자동 저장/finalize에 사용
  const interviewRowIdRef = useRef<string | null>(null);

  // 인터뷰 이미 완료 여부 (뒤로가기 진입 시)
  const [interviewDone, setInterviewDone] = useState(false);

  // ── 컨텍스트 로드 (프로필 + 강점) ──────────────────────────
  useEffect(() => {
    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // 최근 인터뷰 행 조회 — completed: 진입 차단, in_progress: 복원 시도
      const { data: latestRow } = await supabase
        .from('career_interview_results')
        .select('id, status, conversation_messages, conversation_summary')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRow?.status === 'completed') {
        setInterviewDone(true);
        setLoadingContext(false);
        return;
      }

      const [{ data: profile }, { data: strengthData }] = await Promise.all([
        supabase.from('profiles').select('nickname, job_field, career_level, main_concern').eq('id', user.id).single(),
        supabase.from('strength_analyses').select('strengths').eq('user_id', user.id).eq('is_latest', true).limit(1),
      ]);

      // 이전 completed 인터뷰의 요약만 코치 컨텍스트로 사용 (in_progress 제외)
      const { data: prevInterviews } = await supabase
        .from('career_interview_results')
        .select('conversation_summary')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('conversation_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const ctx: UserContext = {
        nickname: profile?.nickname ?? '친구',
        jobField: profile?.job_field ?? '',
        careerLevel: profile?.career_level ?? '',
        mainConcern: profile?.main_concern ?? '',
        strengths: strengthData?.[0]?.strengths ?? [],
        previousSummary: prevInterviews?.[0]?.conversation_summary ?? undefined,
      };
      setContext(ctx);

      if (latestRow?.status === 'in_progress') {
        // DB에 저장된 진행 중 세션 — 복원 팝업 표시
        interviewRowIdRef.current = latestRow.id;
        const dbMsgs = (latestRow.conversation_messages as Array<{ role: 'user' | 'assistant'; content: string }> | null) ?? [];
        const hasUserReply = dbMsgs.some((m) => m.role === 'user');
        if (hasUserReply) {
          savedSessionRef.current = {
            messages: dbMsgs.map((m) => ({
              id: crypto.randomUUID(),
              role: m.role,
              content: m.content,
              timestamp: new Date(),
            })),
          };
          setShowResumePrompt(true);
        } else {
          // in_progress 행은 있지만 대화 내용 없음 → 기존 행 재사용하며 새 시작
          startNewInterview(ctx);
        }
      } else {
        // 새 인터뷰 — DB에 in_progress 행 미리 생성
        const { data: newRow } = await supabase
          .from('career_interview_results')
          .insert({ user_id: user.id, status: 'in_progress' })
          .select('id')
          .single();
        interviewRowIdRef.current = newRow?.id ?? null;

        // sessionStorage 복원 확인 (브라우저 새로고침 대비)
        const saved = loadSession();
        const hasUserReply = saved?.messages.some((m) => m.role === 'user') ?? false;
        if (saved && hasUserReply) {
          savedSessionRef.current = saved;
          setShowResumePrompt(true);
        } else {
          startNewInterview(ctx);
        }
      }

      setLoadingContext(false);
    };

    loadContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewInterview = useCallback((ctx: UserContext) => {
    clearSession();
    const opening: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: buildOpeningMessage(ctx),
      timestamp: new Date(),
    };
    setMessages([opening]);
    setIsComplete(false);
    setPhase('opening');
    setAgreedFocus('');
    setSessionDuration('medium');
    saveSession([opening]);
  }, []);

  const resumeInterview = useCallback(() => {
    const saved = savedSessionRef.current;
    if (!saved) return;
    setMessages(saved.messages);
    setIsComplete(false);
    // 정확한 phase 복원은 어려우므로 가장 흔한 중간 상태로 가정.
    // AI는 phase를 단서로만 사용하므로 미세한 어긋남은 무해.
    setPhase('exploration');
    setShowResumePrompt(false);
  }, []);

  const discardAndRestart = useCallback(() => {
    setShowResumePrompt(false);
    if (!context || !userId) return;

    // 이전 in_progress 행 버리기 (fire-and-forget)
    const oldRowId = interviewRowIdRef.current;
    if (oldRowId) {
      void (async () => {
        try {
          await supabase.from('career_interview_results').update({ status: 'abandoned' }).eq('id', oldRowId);
        } catch { /* ignore */ }
      })();
    }

    // 새 in_progress 행 생성
    void (async () => {
      try {
        const { data } = await supabase
          .from('career_interview_results')
          .insert({ user_id: userId, status: 'in_progress' })
          .select('id')
          .single();
        interviewRowIdRef.current = data?.id ?? null;
      } catch {
        interviewRowIdRef.current = null;
      }
    })();

    startNewInterview(context);
  }, [context, userId, startNewInterview]);

  // ── 스크롤 헬퍼 ──────────────────────────────────────────
  // iOS Safari에서 scrollIntoView는 overflow 컨테이너가 아닌
  // 페이지를 스크롤하는 버그가 있음 → scrollTop 직접 제어
  const scrollToBottom = useCallback((instant = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
  }, []);

  // ── 새 메시지 도착 시 스크롤 ──────────────────────────────
  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  // ── body 스크롤 잠금 (이 페이지에서만) ──────────────────
  // overflow:hidden만으로도 page scroll 방지 가능
  // position:fixed는 쓰지 않음 → visualViewport.height 계산이 깨짐
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // ── 키보드 대응: 컨테이너 높이를 visualViewport에 맞춤 ──
  // 핵심 원리: containerRef(position:fixed)의 height를 vv.height로 직접 설정
  //   → 키보드가 올라오면 vv.height가 줄어들고 → 컨테이너도 같이 줄어들고
  //   → composer(flex-shrink:0)가 자연스럽게 컨테이너 맨 아래 = 키보드 바로 위
  //   → 갭 없음, translate 없음, CSS 변수 없음
  //
  // body:fixed를 쓰지 않는 이유:
  //   body가 position:fixed면 iOS Safari가 visualViewport.height를 업데이트 안 해서
  //   키보드 높이 계산이 항상 0이 됨
  useEffect(() => {
    const vv = window.visualViewport;
    const el = containerRef.current;
    if (!vv || !el) return;

    const update = () => {
      // 컨테이너 크기를 시각적 뷰포트(키보드 제외)에 정확히 맞춤
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;

      // 키보드가 올라왔을 때 마지막 메시지가 composer에 가려지면 스크롤
      const messagesEl = messagesContainerRef.current;
      if (messagesEl) {
        const dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
        if (dist < 120) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      el.style.height = '';
      el.style.top = '';
    };
  }, []);

  // ── finalize 트리거 (Path A 자연 종료 / Path B 사용자 exit / 진단 완료 버튼) ──
  const triggerFinalize = useCallback(async (msgs: Message[]) => {
    if (!userId || !context) return;
    setFinalizeError('');
    setIsFinalizing(true);

    try {
      const result = await finalizeInterview(msgs, context, userId, interviewRowIdRef.current);
      // CONTRACT_v2 §7: 세션 무효 — 신규 4키 중 핵심 3개가 모두 빈 문자열이면 결과 화면 진입 차단
      const invalid =
        !result.extraction.presenting_issue &&
        !result.extraction.agreed_focus &&
        !result.extraction.user_takeaway;
      if (invalid) {
        // 분석 결과가 비면(실질 내용 없음) 결과 페이지 대신 '결과 불가' 안내 → 홈.
        setShowHomeGuide(true);
        return;
      }
      clearSession();
      // 백그라운드 요약 생성 (fire-and-forget) — 사용자를 기다리게 하지 않음
      fetch('/api/career-interview/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: result.interviewId,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      }).catch((e) => console.warn('[summarize] background call failed:', e));
      router.push('/onboarding/career-result');
    } catch {
      setFinalizeError('저장 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setIsFinalizing(false);
    }
  }, [userId, context, router]);

  // ── Path C: 정서 위기 — AI 추출 스킵, DB에 메타만 INSERT, 모달 띄움 ──
  const triggerCrisisFinalize = useCallback(async () => {
    if (!userId) return;
    try {
      const rowId = interviewRowIdRef.current;
      if (rowId) {
        await supabase
          .from('career_interview_results')
          .update({
            key_insights: null,
            session_duration_choice: sessionDuration,
            ai_summary: '정서 위기 가드레일 작동으로 인터뷰 중단',
            status: 'completed',
          })
          .eq('id', rowId);
      } else {
        // rowId 없는 예외 상황 — INSERT fallback
        await supabase
          .from('career_interview_results')
          .insert({
            user_id: userId,
            key_insights: null,
            session_duration_choice: sessionDuration,
            ai_summary: '정서 위기 가드레일 작동으로 인터뷰 중단',
            status: 'completed',
          });
      }
    } catch {
      // 실패해도 모달은 띄움 — 안전이 우선
    }
    clearSession();
    setShowCrisisModal(true);
  }, [userId, sessionDuration]);

  // ── 채팅 한 턴 실행 (네트워크 호출 + 응답 처리) ──────────────
  //   일시적 네트워크 단절(클라이언트↔서버 연결 끊김 등)을 흡수하기 위해 1회 자동 재시도.
  //   자동 재시도까지 실패하면 sendError로 '다시 보내기'를 노출(메시지 손실 없음).
  const runChatTurn = useCallback(async (
    msgs: Message[],
    meta: { turnCount: number; isCrisis: boolean },
  ) => {
    if (!context) return;
    setSendError(false);
    setIsSending(true);
    pendingTurnRef.current = { msgs, meta }; // 실패 시 수동 재전송용 보존

    try {
      // 1회 자동 재시도: 첫 호출이 실패하면 짧은 backoff 후 한 번 더.
      let response: AIResponse;
      try {
        response = await sendMessageToAI({ messages: msgs, context });
      } catch {
        await new Promise((r) => setTimeout(r, 800));
        response = await sendMessageToAI({ messages: msgs, context }); // 2차 실패는 아래 catch로
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      const updatedMessages = [...msgs, assistantMessage];
      setMessages(updatedMessages);
      pendingTurnRef.current = null; // 성공 → 재전송 정보 해제

      // 중간 자동 저장 (fire-and-forget) — 브라우저 닫아도 대화 복원 가능
      const rowId = interviewRowIdRef.current;
      if (rowId) {
        void (async () => {
          try {
            await supabase
              .from('career_interview_results')
              .update({ conversation_messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })) })
              .eq('id', rowId);
          } catch (e) {
            console.warn('[interview] auto-save failed:', e);
          }
        })();
      }

      // Path C: 정서 위기 — 추출 스킵, DB 메타만 INSERT, Crisis 모달
      if (meta.isCrisis) {
        await triggerCrisisFinalize();
        return;
      }

      // Phase 자동 전환
      const next = inferPhase(phase, response.content, meta.turnCount);
      if (next.phase !== phase) setPhase(next.phase);
      if (next.agreedFocus && next.agreedFocus !== agreedFocus) {
        setAgreedFocus(next.agreedFocus);
      }

      // Path A: 코치 자연 종료 발화 감지 시 완료 상태로 전환
      if (detectCoachClosing(response.content)) {
        setIsComplete(true);
        saveSession(updatedMessages);
        return;
      }

      if (response.isInterviewComplete) {
        setIsComplete(true);
        clearSession();
      } else {
        saveSession(updatedMessages);
      }
    } catch {
      // 자동 재시도까지 실패 → 막다른 에러 버블 대신 '다시 보내기' 노출.
      setSendError(true);
    } finally {
      setIsSending(false);
      // iOS Safari: 키보드 전환 직후 프로그래매틱 focus()를 호출하면
      // visualViewport resize가 두 번 발생하면서 position:fixed 컨테이너의
      // 터치 히트 영역이 오래된 좌표로 고정되는 버그 발생 → 입력창이 안 눌림
      // 모바일(iOS)에서는 skip, 데스크탑에서만 재포커스
      const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (!isIOS) {
        textareaRef.current?.focus();
      }
    }
  }, [context, phase, agreedFocus, triggerCrisisFinalize]);

  // ── 메시지 전송 ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !context || !userId) return;

    const trimmed = input.trim();
    const userMsgCountBefore = messages.filter((m) => m.role === 'user').length;

    // Path B: 사용자 주도 종료 키워드 감지 시 chat 호출 생략하고 완료 상태로 전환
    //   (자동 finalize 하지 않음 — 사용자가 대화를 다시 보고 '진단 완료하기'를 눌러야 진행)
    if (detectUserExit(trimmed)) {
      const exitMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        displayContent: trimmed,
        timestamp: new Date(),
      };
      const closingMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '네, 여기까지 이야기 나눈 것만으로도 충분해요. 위로 올려 대화를 다시 보실 수 있고, 준비되시면 아래 ‘진단 완료하기’를 눌러주세요. 😊',
        timestamp: new Date(),
      };
      const next = [...messages, exitMessage, closingMessage];
      setMessages(next);
      setInput('');
      setIsComplete(true);
      saveSession(next);
      return;
    }

    // 첫 시간 응답이면 sessionDuration 추정값 갱신 (실제 DB값은 finalize 응답이 source of truth)
    let nextSessionDuration = sessionDuration;
    if (phase === 'opening' && userMsgCountBefore === 0) {
      nextSessionDuration = classifySessionDuration(trimmed);
      setSessionDuration(nextSessionDuration);
    }

    // Path C 감지 (chat 호출은 진행 — AI 시스템 프롬프트가 redirect 멘트 출력)
    const isCrisis = detectCrisisRed(trimmed);

    // Running State <현재_상태> 블록 prefix 주입 (CONTRACT_v2 §5)
    const turnCount = userMsgCountBefore + 1;
    const prefix = buildRunningStatePrefix({
      phase,
      agreedFocus,
      turnCount,
      sessionDuration: nextSessionDuration,
    });

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prefix + trimmed, // AI 전송용
      displayContent: trimmed,    // UI 렌더링용
      timestamp: new Date(),
    };

    setInput('');

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    await runChatTurn(nextMessages, { turnCount, isCrisis });
  }, [input, isSending, context, userId, messages, phase, agreedFocus, sessionDuration, runChatTurn]);

  // ── '다시 보내기' — 마지막으로 실패한 턴을 그대로 재전송 ──────
  //   사용자 메시지는 이미 대화에 남아 있으므로 손실 없음. 같은 messages로 재호출.
  const handleRetrySend = useCallback(() => {
    const pending = pendingTurnRef.current;
    if (!pending || isSending) return;
    runChatTurn(pending.msgs, pending.meta);
  }, [isSending, runChatTurn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 진단 완료하기 (사용자가 직접 누르는 경우) ─────────────────
  const handleFinalize = useCallback(async () => {
    await triggerFinalize(messages);
  }, [triggerFinalize, messages]);

  // ── textarea 자동 높이 ────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ── 인터뷰 이미 완료 — 다시하기 핸들러 ─────────────────────
  const [isRedoing, setIsRedoing] = useState(false);

  const handleRedo = useCallback(async () => {
    if (!userId || isRedoing) return;
    setIsRedoing(true);
    try {
      // 기존 인터뷰 결과 삭제 (새 인터뷰를 위해)
      await supabase
        .from('career_interview_results')
        .delete()
        .eq('user_id', userId);

      // 컨텍스트 다시 로드 (profile + 강점)
      const [{ data: profile }, { data: strengthData }] = await Promise.all([
        supabase.from('profiles').select('nickname, job_field, career_level, main_concern').eq('id', userId).single(),
        supabase.from('strength_analyses').select('strengths').eq('user_id', userId).eq('is_latest', true).limit(1),
      ]);

      const ctx: UserContext = {
        nickname: profile?.nickname ?? '친구',
        jobField: profile?.job_field ?? '',
        careerLevel: profile?.career_level ?? '',
        mainConcern: profile?.main_concern ?? '',
        strengths: strengthData?.[0]?.strengths ?? [],
      };

      setContext(ctx);
      setInterviewDone(false);
      startNewInterview(ctx);
    } finally {
      setIsRedoing(false);
    }
  }, [userId, isRedoing, startNewInterview]);

  // ── 인터뷰 이미 완료 (뒤로가기 진입) ─────────────────────
  if (interviewDone) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(430px, 100vw)', height: '100dvh',
        background: 'var(--surface)',
        boxShadow: '0 0 40px rgba(0,0,0,.18)',
        overflow: 'hidden',
      }}>
        {/* ── 배경: 채팅 UI 목업 ────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.45,
          pointerEvents: 'none', display: 'flex', flexDirection: 'column',
        }}>
          {/* 헤더 */}
          <div style={{ padding: '8px 16px 6px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
              <div style={{ width: '44px', height: '28px', borderRadius: '6px', background: 'var(--border)' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>커리어 인터뷰</span>
              <div style={{ width: '44px' }} />
            </div>
          </div>
          {/* 메시지 영역 */}
          <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-primary)' }}>
                안녕하세요! 강점을 바탕으로 커리어 방향을 함께 찾아볼게요. 오늘 시간은 어느 정도 되세요?
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 4px 18px', background: 'var(--accent)', fontSize: '14px', lineHeight: 1.65, color: '#fff' }}>
                30분 정도 여유 있어요!
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-primary)' }}>
                좋아요! 요즘 커리어에서 가장 마음에 걸리는 게 있다면 어떤 건가요?
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row-reverse', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 4px 18px', background: 'var(--accent)', fontSize: '14px', lineHeight: 1.65, color: '#fff' }}>
                성장 방향을 잘 모르겠어서요. 뭘 더 해야 할지...
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-primary)' }}>
                그 막막함, 정말 잘 공감돼요. 지금 하시는 일 중에서 유독 에너지가 생기는 순간이 있으신가요?
              </div>
            </div>
          </div>
          {/* 입력창 */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, height: '44px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface)' }} />
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--border)' }} />
          </div>
        </div>

        {/* ── 흰색 오버레이 + 완료 안내 패널 ──────────────────── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 32px',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--accent-light)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize: '21px', fontWeight: 800, marginBottom: '10px', letterSpacing: '-.03em', textAlign: 'center', color: 'var(--text-primary)' }}>
            인터뷰를 완료하셨어요!
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, textAlign: 'center', marginBottom: '36px' }}>
            AI 커리어 인터뷰가 이미 완료됐어요.<br />
            결과를 확인하거나 다시 진행할 수 있어요.
          </div>
          <button
            onClick={() => router.push('/onboarding/career-result')}
            style={{ ...btnPrimary, marginBottom: '12px' }}
          >
            결과 보기 →
          </button>
          <button
            onClick={handleRedo}
            disabled={isRedoing}
            style={{
              ...btnOutline,
              opacity: isRedoing ? 0.6 : 1,
              cursor: isRedoing ? 'not-allowed' : 'pointer',
            }}
          >
            {isRedoing ? '준비 중...' : '커리어 인터뷰 다시하기'}
          </button>
        </div>
      </div>
    );
  }

  // ── 로딩 상태 ────────────────────────────────────────────
  if (loadingContext) {
    return (
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(430px, 100vw)', height: '100dvh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(0,0,0,.18)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          <div style={{ marginBottom: '12px', fontSize: '24px' }}>✨</div>
          인터뷰 준비 중...
        </div>
      </div>
    );
  }

  // 종료 시 '의미있는 결과 생성' 자격 판정 — 종료 동작 분기의 단일 게이트.
  //   ⚠️ exploration 진입(주제 합의)만으론 방향성이 아직 없으므로 '준비됨'으로 보지 않는다.
  //   준비됨(→ 결과) = 코치가 마무리 질문을 시작(closing) OR 탐색이 충분히 깊어짐(≥N턴).
  //   그 외(빈 세션·합의·얕은 탐색) = 분석 불가 → 따뜻한 안내 후 홈으로(대화는 보존, 이어가기 가능).
  const RESULT_READY_MIN_TURNS = 6; // 탐색 깊이 보조선(사용자 답변 누적). 조정 가능.
  const userTurnCount = messages.filter((m) => m.role === 'user').length;
  const isReadyForResult =
    phase === 'closing' ||
    (phase === 'exploration' && userTurnCount >= RESULT_READY_MIN_TURNS);

  return (
    <div
      ref={containerRef}
      style={{
        // position:fixed + top/height를 JS로 visualViewport에 맞춤
        // → 키보드 열리면 컨테이너 자체가 줄어들고, composer가 자연스럽게 키보드 위에 딱 붙음
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(430px, 100vw)',
        height: '100dvh', // JS update() 호출 전 초기값
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 40px rgba(0,0,0,.18)',
        overflow: 'hidden',
      }}
    >

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header style={{
        padding: '8px 16px 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <button
            onClick={() => router.push('/onboarding/career-intro')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0,
            }}
            aria-label="이전으로"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>
            커리어 인터뷰
          </span>
          {/* 우측: "인터뷰 종료하기" 버튼 (진행 중에만 노출, 완료/분석 중엔 대칭용 빈 div) */}
          {!isComplete && !isFinalizing ? (
            <button
              className="end-interview-btn"
              onClick={() => {
                // 충분히 진행됐으면 결과 생성 확인, 아니면(빈/얕음) 홈 안내.
                if (isReadyForResult) setShowEndConfirm(true);
                else setShowHomeGuide(true);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                padding: '8px 13px', borderRadius: '999px',
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                fontFamily: 'inherit', lineHeight: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                WebkitTapHighlightColor: 'transparent',
                marginTop: '6px', // 제목보다 살짝 아래로
              }}
              aria-label="인터뷰 종료"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              인터뷰 종료
            </button>
          ) : (
            <div style={{ width: '44px', flexShrink: 0 }} />
          )}
        </div>
      </header>

      {/* ── 세션 복원 프롬프트 ────────────────────────────── */}
      {showResumePrompt && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 'min(430px, 100vw)', height: '100dvh',
          background: 'rgba(0,0,0,.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '24px',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '20px',
            padding: '28px 24px', width: '100%',
          }}>
            <div style={{ fontSize: '20px', textAlign: 'center', marginBottom: '8px' }}>💬</div>
            <div style={{ fontSize: '17px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
              이전 인터뷰가 있어요
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
              이어서 진행할까요?
            </p>
            <button
              onClick={resumeInterview}
              style={{ ...btnPrimary, marginBottom: '10px' }}
            >
              이어서 진행하기
            </button>
            <button
              onClick={discardAndRestart}
              style={btnOutline}
            >
              처음부터 시작하기
            </button>
          </div>
        </div>
      )}

      {/* ── 인터뷰 종료 확인 (충분히 진행됨 → 결과 생성) ──── */}
      {showEndConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 'min(430px, 100vw)', height: '100dvh',
            background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px',
          }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px 24px', width: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
              인터뷰를 종료할까요?
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
              지금 종료하면 지금까지 나눈 내용으로 커리어 결과를 만들어 드려요.
            </p>
            <button
              onClick={() => {
                setShowEndConfirm(false);
                handleFinalize(); // 곧장 finalize → 결과 페이지
              }}
              style={btnPrimary}
            >
              종료하고 결과 보기
            </button>
            <button
              onClick={() => setShowEndConfirm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', width: '100%', padding: '12px', marginTop: '4px' }}
            >
              계속하기
            </button>
          </div>
        </div>
      )}

      {/* ── 결과 불가 안내 (빈/얕은 세션 또는 분석 무효 → 홈) ── */}
      {showHomeGuide && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 'min(430px, 100vw)', height: '100dvh',
            background: 'rgba(0,0,0,.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px',
          }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px 24px', width: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
              아직 분석할 이야기가 없어요
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
              {userTurnCount === 0
                ? '아직 나눈 대화가 없어 커리어 결과를 만들 수 없어요. 홈으로 돌아갈게요 — 준비되면 언제든 다시 시작할 수 있어요.'
                : '아직 결과를 만들 만큼 이야기가 충분하지 않아요. 더 이야기 나누면 커리어 결과를 만들 수 있어요. 홈으로 돌아가도 나눈 대화는 이어서 진행할 수 있어요.'}
            </p>
            {/* 강조: 계속 이야기하기 (대화로 복귀) */}
            <button
              onClick={() => setShowHomeGuide(false)}
              style={btnPrimary}
            >
              계속 이야기하기
            </button>
            {/* 보조: 홈으로 (세션은 보존 → 다음에 이어가기 가능) */}
            <button
              onClick={() => {
                setShowHomeGuide(false);
                router.push('/home');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', width: '100%', padding: '12px', marginTop: '4px' }}
            >
              홈으로 나가기
            </button>
          </div>
        </div>
      )}

      {/* ── 채팅 메시지 영역 ─────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '20px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* AI 타이핑 인디케이터 */}
        {isSending && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <AIAvatar />
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: '18px 18px 18px 4px',
              padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--text-muted)',
                  animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 분석 로딩 오버레이 (인사이트 3 대응: 시간 현실화 + 변동 안내) ─── */}
      {isFinalizing && (
        <div style={{
          position: 'absolute', inset: 0, top: 0, left: '50%',
          transform: 'translateX(-50%)', width: 'min(430px, 100vw)',
          background: 'rgba(255,255,255,.95)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '14px',
          zIndex: 50,
          padding: '0 24px',
        }}>
          <div style={{ fontSize: '36px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            커리어 방향을 분석 중이에요
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            lineHeight: 1.55,
          }}>
            약 20초 정도 걸려요
            <br />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              상황에 따라 조금 더 걸릴 수 있어요
            </span>
          </div>
          <LoadingDots />
        </div>
      )}

      {/* ── 하단 입력 영역 ──────────────────────────────── */}
      {/* flex-shrink:0 → 컨테이너 높이가 줄어들면 메시지 영역이 줄고, composer는 맨 아래 유지 */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>

        {/* 에러 메시지 */}
        {finalizeError && (
          <div style={{
            margin: '10px 16px 0',
            padding: '10px 14px', borderRadius: '10px',
            background: '#FEF2F2', border: '1.5px solid #FECACA',
            fontSize: '13px', color: '#DC2626',
          }} role="alert">
            {finalizeError}
          </div>
        )}

        {/* 전송 실패 (자동 재시도 후에도): 다시 보내기 */}
        {sendError && !isSending && (
          <div style={{
            margin: '10px 16px 0',
            padding: '10px 14px', borderRadius: '10px',
            background: '#FEF2F2', border: '1.5px solid #FECACA',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          }} role="alert">
            <span style={{ fontSize: '13px', color: '#DC2626' }}>
              메시지를 보내지 못했어요.
            </span>
            <button
              onClick={handleRetrySend}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: '8px',
                border: '1px solid #DC2626', background: '#fff', color: '#DC2626',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              다시 보내기
            </button>
          </div>
        )}

        {/* 완료 상태: 버튼 영역 */}
        {isComplete && !isFinalizing && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={handleFinalize} style={btnPrimary}>
              진단 완료하기 →
            </button>
          </div>
        )}

        {/* 진행 중: 입력창 */}
        {!isComplete && (
          <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="답변을 입력해주세요"
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                fontSize: '16px', // iOS Safari: 16px 미만이면 포커스 시 자동 확대됨
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                outline: 'none',
                lineHeight: 1.5,
                minHeight: '44px',
                maxHeight: '120px',
                overflow: 'auto',
              }}
              aria-label="인터뷰 답변 입력"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: input.trim() && !isSending ? 'var(--accent)' : isSending ? 'var(--accent)' : 'var(--border)',
                border: 'none', cursor: input.trim() && !isSending ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background .2s',
              }}
              aria-label="전송"
            >
              {isSending ? (
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  border: '2.5px solid rgba(255,255,255,0.35)',
                  borderTopColor: 'white',
                  animation: 'spin 0.75s linear infinite',
                }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 19-7z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 타이핑 애니메이션 + 스피너 스타일 */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .end-interview-btn {
          transition: background .15s ease, border-color .15s ease, box-shadow .15s ease, transform .08s ease;
        }
        .end-interview-btn:hover {
          background: var(--bg);
          border-color: var(--text-muted);
          box-shadow: 0 2px 6px rgba(0,0,0,.12);
        }
        .end-interview-btn:active {
          transform: scale(.95);
          box-shadow: 0 1px 2px rgba(0,0,0,.10);
        }
      `}</style>

      {/* Path C 정서 위기 모달 */}
      <CrisisModal
        open={showCrisisModal}
        onClose={() => {
          setShowCrisisModal(false);
          clearSession();
          router.push('/home');
        }}
      />

    </div>
  );
}

// ── 메시지 버블 ──────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '8px', alignItems: 'flex-end',
    }}>
      {!isUser && <AIAvatar />}
      <div style={{
        maxWidth: '78%',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'var(--accent)' : 'var(--bg)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontSize: '14px', lineHeight: 1.65,
        color: isUser ? '#fff' : 'var(--text-primary)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.displayContent ?? message.content}
      </div>
    </div>
  );
}

// ── AI 아바타 ────────────────────────────────────────────────
function AIAvatar() {
  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      background: 'var(--accent)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    </div>
  );
}

// ── 로딩 도트 ────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--accent)',
          animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── 공통 버튼 스타일 ─────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: '12px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', fontSize: '15px', fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(45,91,255,.3)',
};

const btnOutline: React.CSSProperties = {
  width: '100%', padding: '14px', borderRadius: '12px',
  background: 'none', color: 'var(--accent)',
  border: '1.5px solid var(--accent)', fontSize: '14px', fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
};

// ── Path C 정서 위기 모달 ─────────────────────────────────────
function CrisisModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }} role="dialog" aria-modal="true">
      <div style={{
        background: 'var(--surface)', borderRadius: '20px',
        padding: '28px 24px', maxWidth: '340px', width: '100%',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)',
      }}>
        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
          잠시 멈추고 알려드릴 게 있어요
        </div>
        <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: '16px' }}>
          지금 말씀해주신 마음은 혼자 견디지 않으셔도 됩니다. 아래 번호로 연결해보시는 걸 권해드려요.
        </p>
        <ul style={{ fontSize: '14px', listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-primary)' }}>
          <li>📞 <b>자살예방상담전화 1393</b> (24시간 무료)</li>
          <li>📞 <b>정신건강 위기상담전화 1577-0199</b> (24시간)</li>
        </ul>
        <button onClick={onClose} style={btnPrimary}>닫고 홈으로</button>
      </div>
    </div>
  );
}

// ── Suspense 래퍼 ────────────────────────────────────────────
export default function CareerInterviewPage() {
  return (
    <Suspense>
      <CareerInterviewContent />
    </Suspense>
  );
}
