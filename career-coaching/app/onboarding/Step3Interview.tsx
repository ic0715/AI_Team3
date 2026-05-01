"use client";

import { useState, useRef, useEffect } from "react";
import { OnboardingData } from "@/lib/types";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface Message {
  id: number;
  role: "ai" | "user";
  text: string;
  time: string;
  type?: "clarity-check";
  clarityReflection?: string;
}

interface Props {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
}

function getTime() {
  return new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

const OPENING: Message = {
  id: 0,
  role: "ai",
  text: "안녕하세요. 오늘 세션을 시작하기 전에, 지금 이 자리에서 가장 다루고 싶은 것이 무엇인지 먼저 여쭤봐도 될까요?",
  time: getTime(),
};

export default function Step3Interview({ data, update, onNext }: Props) {
  const [messages, setMessages] = useState<Message[]>([OPENING]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSending = useRef(false);
  const nextId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const addMessage = (msg: Omit<Message, "id" | "time">) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId.current++, time: getTime() }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isTyping || isSending.current) return;

    isSending.current = true;
    setInput("");

    const userMsg: Message = { id: nextId.current++, role: "user", text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);

    // Build API messages: exclude OPENING (id=0), include new user message
    const apiMessages = [
      ...messages.filter((m) => m.id !== 0 && m.type !== "clarity-check"),
      userMsg,
    ].map((m) => ({ role: m.role, text: m.text }));

    const turnCount = messages.filter((m) => m.role === "user").length + 1;

    update({
      interviewAnswers: [
        ...data.interviewAnswers,
        { question: messages[messages.length - 1]?.text ?? "", answer: text },
      ],
    });

    setIsTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, data, turnCount }),
      });

      const json = await res.json();
      setIsTyping(false);

      if (json.error) {
        addMessage({ role: "ai", text: "죄송해요, 응답을 가져오는 데 문제가 생겼어요. 다시 시도해 주세요." });
        return;
      }

      if (json.clarityDetected && json.clarityReflection) {
        addMessage({ role: "ai", type: "clarity-check", text: "", clarityReflection: json.clarityReflection });
      } else {
        addMessage({ role: "ai", text: json.reply });
      }
    } catch {
      setIsTyping(false);
      addMessage({ role: "ai", text: "네트워크 오류가 발생했어요. 다시 시도해 주세요." });
    } finally {
      isSending.current = false;
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isTyping) {
      e.preventDefault();
      send();
    }
  };

  const toggleRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해 주세요.");
      return;
    }

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? " " : "") + transcript);
    };

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  const userTurnCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)]">
      {/* 헤더 */}
      <div className="bg-white border-b border-[var(--border)] px-4 pt-safe flex-shrink-0">
        <div className="flex items-center gap-3 h-14">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" fill="var(--accent)" />
              <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-600 text-[var(--text-primary)]">AI 코치</p>
            <p className="text-xs text-[var(--text-muted)]">
              {data.name ? `${data.name}님의 코칭 세션` : "코칭 세션 진행 중"}
            </p>
          </div>
          <div className="text-xs text-[var(--text-muted)] bg-[var(--bg)] px-2.5 py-1 rounded-full">
            {userTurnCount}번 답변
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) =>
          msg.type === "clarity-check" ? (
            <ClarityCard
              key={msg.id}
              reflection={msg.clarityReflection!}
              time={msg.time}
              onConfirm={onNext}
              onContinue={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
            />
          ) : msg.role === "ai" ? (
            <AiBubble key={msg.id} text={msg.text} time={msg.time} />
          ) : (
            <UserBubble key={msg.id} text={msg.text} time={msg.time} />
          )
        )}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* 녹음 중 표시 */}
      {recording && (
        <div className="flex-shrink-0 bg-red-50 border-t border-red-100 px-4 py-2 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <div className="flex gap-0.5 items-center h-4">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="w-1 bg-red-400 rounded-full wave-bar"
                style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-red-500 font-medium">녹음 중 · 탭하여 중지</span>
        </div>
      )}

      {/* 입력 바 */}
      <div className="flex-shrink-0 bg-white border-t border-[var(--border)] px-3 py-3">
        <div className="flex items-end gap-2">
          <button
            onClick={toggleRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              recording
                ? "bg-red-500 text-white"
                : "bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="6" y="1" width="6" height="10" rx="3" fill="currentColor" />
              <path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="14" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="답변을 입력하거나 마이크를 눌러보세요"
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-sm resize-none leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: "40px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 112) + "px";
            }}
          />

          <button
            onClick={send}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8L2 2l3 6-3 6 12-6z" fill="white" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AiBubble({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-end gap-2 max-w-[82%] fade-up">
      <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0 mb-4">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4.5" r="2.5" fill="var(--accent)" />
          <path d="M1.5 13c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-[var(--border)]">
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">{text}</p>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1 ml-1">{time}</p>
      </div>
    </div>
  );
}

function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex flex-col items-end fade-up">
      <div className="bg-[var(--accent)] rounded-2xl rounded-br-sm px-4 py-3 max-w-[82%]">
        <p className="text-sm text-white leading-relaxed">{text}</p>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1 mr-1">{time}</p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 max-w-[82%]">
      <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0 mb-4">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4.5" r="2.5" fill="var(--accent)" />
          <path d="M1.5 13c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-[var(--border)] flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] wave-bar"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function ClarityCard({
  reflection,
  time,
  onConfirm,
  onContinue,
}: {
  reflection: string;
  time: string;
  onConfirm: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fade-up slide-up">
      <div className="bg-[var(--accent-light)] border border-[var(--accent)] border-opacity-30 rounded-2xl px-4 py-4 mx-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-600 text-[var(--accent)] bg-white px-2 py-0.5 rounded-full">
            고민 명료화 확인
          </span>
        </div>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-4">{reflection}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-[var(--accent)] text-white text-sm font-600 transition-all active:scale-95"
          >
            네, 맞아요
          </button>
          <button
            onClick={onContinue}
            className="flex-1 h-10 rounded-xl bg-white border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium transition-all active:scale-95"
          >
            더 이야기할게요
          </button>
        </div>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1 ml-3">{time}</p>
    </div>
  );
}
