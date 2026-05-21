'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────
// 🤖 AI 연동 인터페이스 (AI 개발자가 여기만 수정하면 됩니다)
//
// 현재: mock 구현 (하드코딩된 Q1~Q6 순서대로 응답)
// 교체: sendMessageToAI 함수를 실제 Claude API 호출로 변경
//
// 함수 시그니처:
//   sendMessageToAI(params: AIChatParams) => Promise<AIResponse>
//
// AIChatParams:
//   - messages: 지금까지의 대화 히스토리 (role: 'user'|'assistant', content: string)
//   - context: 사용자 컨텍스트 (프로필 + 강점)
//   - coreQuestionIndex: 현재 코어 질문 몇 번째인지 (0~5, 6이면 완료)
//   - isExtraMode: 인터뷰 더하기 모드 여부
//
// AIResponse:
//   - content: AI 응답 텍스트
//   - nextCoreQuestionIndex: 다음 코어 질문 인덱스 (follow-up이면 그대로 유지)
//   - isInterviewComplete: 인터뷰 완료 여부 (코어 6개 모두 완료 시 true)
//
// finalizeInterview 함수:
//   인터뷰 완료 후 DB에 저장하는 함수
//   messages + context → key_insights JSONB + ai_summary text 추출
//   현재: mock 구현 (빈 객체 저장)
//   교체: 실제 Claude API 호출로 변경
// ─────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  coreQuestionIndex: number;
  isExtraMode: boolean;
}

interface AIResponse {
  content: string;
  nextCoreQuestionIndex: number;
  isInterviewComplete: boolean;
}

// 코어 질문 6개 (스펙 3.2)
const CORE_QUESTIONS = [
  '지금 직장 생활에서 만족스러운 점과 그렇지 않은 점은?',
  '5년 후, 어떤 모습이 되어 있길 바라나요?',
  '일할 때 어떤 가치관을 중요하게 여기나요?',
  '어떤 환경에서 가장 좋은 성과를 내는 편인가요?',
  '', // Q5는 강점 이름이 들어가야 해서 런타임에 생성
  '시간/돈 제약이 없다면, 1년 동안 무엇을 시도해 보고 싶나요?',
];

// ── 🤖 AI 연동 함수 (Claude API) ────────────────────────────
async function sendMessageToAI(params: AIChatParams): Promise<AIResponse> {
  // 서버 라우트로 전달 (API 키는 서버에만 존재)
  const payload = {
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    context: params.context,
    coreQuestionIndex: params.coreQuestionIndex,
    isExtraMode: params.isExtraMode,
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
async function finalizeInterview(
  messages: Message[],
  context: UserContext,
  userId: string
): Promise<{ key_insights: object; ai_summary: string }> {
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
  const result = (await res.json()) as { key_insights: object; ai_summary: string };

  // 2) 클라이언트(인증된 supabase)로 DB INSERT — RLS 통과
  const { error } = await supabase
    .from('career_interview_results')
    .insert({
      user_id: userId,
      key_insights: result.key_insights,
      ai_summary: result.ai_summary,
    });

  if (error) throw error;
  return result;
}
// ─────────────────────────────────────────────────────────────

// ── 첫 AI 메시지 (인터뷰 시작 인사) ─────────────────────────
function buildOpeningMessage(context: UserContext): string {
  const strengthNames = context.strengths.map((s) => s.name_ko).join(', ');
  return `안녕하세요, ${context.nickname}님! 😊\n\n강점(${strengthNames})을 바탕으로 커리어 방향을 함께 찾아볼게요. 편하게 솔직하게 답해주시면 돼요.\n\n${CORE_QUESTIONS[0]}`;
}

// ── 세션 저장/복원 (sessionStorage) ─────────────────────────
const SESSION_KEY = 'career_interview_session';

function saveSession(messages: Message[], coreIndex: number) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, coreIndex }));
  } catch {
    // sessionStorage 실패 시 무시
  }
}

function loadSession(): { messages: Message[]; coreIndex: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // timestamp 복원
    parsed.messages = parsed.messages.map((m: Message) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    return parsed;
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
  const [coreQuestionIndex, setCoreQuestionIndex] = useState(0); // 현재까지 진행된 코어 질문 수
  const [isComplete, setIsComplete] = useState(false);
  const [isExtraMode, setIsExtraMode] = useState(false);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 세션 복원 여부
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const savedSessionRef = useRef<{ messages: Message[]; coreIndex: number } | null>(null);

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
    setCoreQuestionIndex(1); // Q1 이미 전달됨
    setIsComplete(false);
    setIsExtraMode(false);
    saveSession([opening], 1);
  }, []);

  const resumeInterview = useCallback(() => {
    const saved = savedSessionRef.current;
    if (!saved) return;
    setMessages(saved.messages);
    setCoreQuestionIndex(saved.coreIndex);
    setIsComplete(saved.coreIndex >= 6);
    setShowResumePrompt(false);
  }, []);

  const discardAndRestart = useCallback(() => {
    setShowResumePrompt(false);
    if (context) startNewInterview(context);
  }, [context, startNewInterview]);

  // ── 스크롤 ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ── 메시지 전송 ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending || !context || !userId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
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
        coreQuestionIndex,
        isExtraMode,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };

      const updatedMessages = [...nextMessages, assistantMessage];
      setMessages(updatedMessages);
      setCoreQuestionIndex(response.nextCoreQuestionIndex);

      if (response.isInterviewComplete) {
        setIsComplete(true);
        clearSession();
      } else {
        saveSession(updatedMessages, response.nextCoreQuestionIndex);
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
  }, [input, isSending, context, userId, messages, coreQuestionIndex, isExtraMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 인터뷰 더하기 모드 진입 ──────────────────────────────
  const handleExtraMode = useCallback(() => {
    setIsExtraMode(true);

    const guideMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '추가로 나누고 싶은 이야기가 있으면 자유롭게 적어주세요 💬',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, guideMessage]);

    // 입력창 enable + focus (스펙 3.5 v1.4)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.disabled = false;
        textareaRef.current.focus();
      }
    }, 100);
  }, []);

  // ── 진단 완료하기 ─────────────────────────────────────────
  const handleFinalize = useCallback(async () => {
    if (!userId || !context) return;
    setFinalizeError('');
    setIsFinalizing(true);

    try {
      await finalizeInterview(messages, context, userId);
      clearSession();
      router.push('/onboarding/career-result');
    } catch {
      setFinalizeError('저장 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setIsFinalizing(false);
    }
  }, [userId, context, messages, router]);

  // ── textarea 자동 높이 ────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ── 진행률 표시 (코어 질문 기준) ─────────────────────────
  const progressRatio = Math.min(coreQuestionIndex / 6, 1);
  const progressLabel = `Q${Math.min(coreQuestionIndex, 6)} / 6`;

  // ── 로딩 상태 ────────────────────────────────────────────
  if (loadingContext) {
    return (
      <div style={{ width: '390px', minHeight: '100dvh', background: 'var(--surface)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(0,0,0,.18)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          <div style={{ marginBottom: '12px', fontSize: '24px' }}>✨</div>
          인터뷰 준비 중...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '390px',
      height: '100dvh',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,.18)',
      overflow: 'hidden',
    }}>

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
          {/* 진행률 라벨 */}
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: isComplete ? 'var(--accent)' : 'var(--text-secondary)',
            minWidth: '48px', textAlign: 'right',
          }}>
            {isComplete ? '완료 ✓' : progressLabel}
          </span>
        </div>

        {/* 진행률 바 (코어 질문 기준, 스펙 3.3) */}
        <div style={{
          height: '4px', borderRadius: '999px',
          background: 'var(--border)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            background: isComplete ? '#10B981' : 'var(--accent)',
            width: `${progressRatio * 100}%`,
            transition: 'width .4s ease, background .3s ease',
          }} />
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
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
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

      {/* ── 하단 영역 ────────────────────────────────────── */}
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

        {/* 완료 상태: 버튼 영역 (스펙 3.5) */}
        {isComplete && !isFinalizing && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={handleFinalize} style={btnPrimary}>
              진단 완료하기 →
            </button>
            {/* 인터뷰 더하기 버튼 — 추가 모드 진입 후에는 숨김 (스펙 3.5 v1.4) */}
            {!isExtraMode && (
              <button onClick={handleExtraMode} style={btnOutline}>
                💬 인터뷰 더하기
              </button>
            )}
          </div>
        )}

        {/* 진행 중: 입력창 */}
        {(!isComplete || isExtraMode) && (
          <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="답변을 입력해주세요 (Shift+Enter로 줄바꿈)"
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                fontSize: '14px',
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
        {message.content}
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

// ── Suspense 래퍼 ────────────────────────────────────────────
export default function CareerInterviewPage() {
  return (
    <Suspense>
      <CareerInterviewContent />
    </Suspense>
  );
}
