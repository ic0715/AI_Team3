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
}

async function finalizeInterview(
  messages: Message[],
  context: UserContext,
  userId: string
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

  // 2) 클라이언트(인증된 supabase)로 DB INSERT — RLS 통과
  const { error } = await supabase
    .from('career_interview_results')
    .insert({
      user_id: userId,
      key_insights: result.extraction,
      session_duration_choice: result.session_duration_choice,
      ai_summary: result.ai_summary,
    });

  if (error) throw error;
  return result;
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
  const [isSessionInvalid, setIsSessionInvalid] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);

  // Running State (CONTRACT_v2 §5)
  const [phase, setPhase] = useState<Phase>('opening');
  const [agreedFocus, setAgreedFocus] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<SessionDurationLabel>('medium');

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);      // 전체 컨테이너 (높이 동적 제어)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 세션 복원 여부
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const savedSessionRef = useRef<{ messages: Message[] } | null>(null);

  // ── 컨텍스트 로드 (프로필 + 강점) ──────────────────────────
  useEffect(() => {
    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const [{ data: profile }, { data: strengthData }] = await Promise.all([
        supabase.from('profiles').select('nickname, job_field, career_level, main_concern').eq('id', user.id).single(),
        supabase.from('strength_analyses').select('strengths').eq('user_id', user.id).eq('is_latest', true).limit(1),
      ]);

      const ctx: UserContext = {
        nickname: profile?.nickname ?? '친구',
        jobField: profile?.job_field ?? '',
        careerLevel: profile?.career_level ?? '',
        mainConcern: profile?.main_concern ?? '',
        strengths: strengthData?.[0]?.strengths ?? [],
      };
      setContext(ctx);

      // 세션 복원 확인 — 유저가 실제로 답변한 경우에만 복원 팝업 표시
      const saved = loadSession();
      const hasUserReply = saved?.messages.some((m) => m.role === 'user') ?? false;
      if (saved && hasUserReply) {
        savedSessionRef.current = saved;
        setShowResumePrompt(true);
      } else {
        startNewInterview(ctx);
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
    if (context) startNewInterview(context);
  }, [context, startNewInterview]);

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
      const result = await finalizeInterview(msgs, context, userId);
      // CONTRACT_v2 §7: 세션 무효 — 신규 4키 중 핵심 3개가 모두 빈 문자열이면 결과 화면 진입 차단
      const invalid =
        !result.extraction.presenting_issue &&
        !result.extraction.agreed_focus &&
        !result.extraction.user_takeaway;
      if (invalid) {
        setIsSessionInvalid(true);
        return;
      }
      clearSession();
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
      await supabase
        .from('career_interview_results')
        .insert({
          user_id: userId,
          key_insights: null,
          session_duration_choice: sessionDuration,
          ai_summary: '정서 위기 가드레일 작동으로 인터뷰 중단',
        });
    } catch {
      // INSERT 실패해도 모달은 띄움 — 안전이 우선
    }
    clearSession();
    setShowCrisisModal(true);
  }, [userId, sessionDuration]);

  // ── 메시지 전송 ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !context || !userId) return;

    const trimmed = input.trim();
    const userMsgCountBefore = messages.filter((m) => m.role === 'user').length;

    // Path B: 사용자 주도 종료 키워드 감지 시 chat 호출 생략하고 즉시 finalize
    if (detectUserExit(trimmed)) {
      const exitMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        displayContent: trimmed,
        timestamp: new Date(),
      };
      const next = [...messages, exitMessage];
      setMessages(next);
      setInput('');
      await triggerFinalize(next);
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
    setIsSending(true);

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const response = await sendMessageToAI({
        messages: nextMessages,
        context,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };

      const updatedMessages = [...nextMessages, assistantMessage];
      setMessages(updatedMessages);

      // Path C: 정서 위기 — 추출 스킵, DB 메타만 INSERT, Crisis 모달
      if (isCrisis) {
        await triggerCrisisFinalize();
        return;
      }

      // Phase 자동 전환
      const next = inferPhase(phase, response.content, turnCount);
      if (next.phase !== phase) setPhase(next.phase);
      if (next.agreedFocus && next.agreedFocus !== agreedFocus) {
        setAgreedFocus(next.agreedFocus);
      }

      // Path A: 코치 자연 종료 발화 감지 시 자동 finalize
      if (detectCoachClosing(response.content)) {
        setIsComplete(true);
        clearSession();
        await triggerFinalize(updatedMessages);
        return;
      }

      if (response.isInterviewComplete) {
        setIsComplete(true);
        clearSession();
      } else {
        saveSession(updatedMessages);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '잠시 연결이 불안정해요. 다시 시도해주세요.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [input, isSending, context, userId, messages, phase, agreedFocus, sessionDuration, triggerFinalize, triggerCrisisFinalize]);

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

  // ── 로딩 상태 ────────────────────────────────────────────
  if (loadingContext) {
    return (
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', height: '100dvh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(0,0,0,.18)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          <div style={{ marginBottom: '12px', fontSize: '24px' }}>✨</div>
          인터뷰 준비 중...
        </div>
      </div>
    );
  }

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
        width: '390px',
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
          {/* 우측 공백 (뒤로가기 버튼과 시각 대칭) */}
          <div style={{ width: '44px', flexShrink: 0 }} />
        </div>
      </header>

      {/* ── 세션 복원 프롬프트 ────────────────────────────── */}
      {showResumePrompt && (
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '390px', height: '100dvh',
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

      {/* ── 분석 로딩 오버레이 ───────────────────────────── */}
      {isFinalizing && (
        <div style={{
          position: 'absolute', inset: 0, top: 0, left: '50%',
          transform: 'translateX(-50%)', width: '390px',
          background: 'rgba(255,255,255,.95)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
          zIndex: 50,
        }}>
          <div style={{ fontSize: '36px' }}>🔍</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            커리어 방향을 분석 중이에요
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            약 5~12초 정도 걸려요
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
                background: input.trim() && !isSending ? 'var(--accent)' : 'var(--border)',
                border: 'none', cursor: input.trim() && !isSending ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background .2s',
              }}
              aria-label="전송"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 19-7z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 타이핑 애니메이션 스타일 */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-5px); opacity: 1; }
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

      {/* 세션 무효 재시도 모달 */}
      <RetryModal
        open={isSessionInvalid}
        onRetry={() => {
          setIsSessionInvalid(false);
          if (context) startNewInterview(context);
        }}
        onSkip={() => {
          setIsSessionInvalid(false);
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

// ── 세션 무효 시 재시도 모달 ──────────────────────────────────
function RetryModal({
  open, onRetry, onSkip,
}: {
  open: boolean;
  onRetry: () => void;
  onSkip: () => void;
}) {
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
          인터뷰가 충분히 진행되지 않았어요
        </div>
        <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: '20px' }}>
          한 가지 풀고 싶은 고민에 대해 좀 더 이야기 나눠보실까요? 다시 시작하시면 됩니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={onRetry} style={btnPrimary}>다시 시도하기</button>
          <button onClick={onSkip} style={btnOutline}>나중에</button>
        </div>
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
