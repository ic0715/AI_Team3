"use client";

/**
 * 개발 모드 플로팅 패널
 *
 * NEXT_PUBLIC_DEV_MODE=true 일 때만 화면 우하단에 표시됨.
 * 온보딩 단계 바로가기, 데이터 세팅/초기화 버튼 제공.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ONBOARDING_STEPS, seedTestData, resetTestData } from "@/lib/dev/seedData";

export default function DevPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 개발 모드가 아니면 아무것도 렌더링하지 않음
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, [open]);

  async function handleSeed() {
    setLoading(true);
    setMessage("");
    const result = await seedTestData();
    setMessage(result.message);
    setLoading(false);
  }

  async function handleReset() {
    setLoading(true);
    setMessage("");
    const result = await resetTestData();
    setMessage(result.message);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMessage("로그아웃 완료");
    router.push("/login");
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[9999] w-12 h-12 rounded-full bg-gray-900 text-white text-xl shadow-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
        title="Dev Panel"
      >
        🧪
      </button>

      {/* 패널 */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[9999] w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-sm">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800">🧪 Dev Panel</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* 로그인 상태 */}
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">
            {userEmail ? (
              <>
                <span className="text-green-600 font-bold">● 로그인됨</span>
                <br />
                {userEmail}
              </>
            ) : (
              <span className="text-red-500 font-bold">● 로그인 안됨</span>
            )}
          </div>

          {/* 데이터 세팅 버튼 */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 font-semibold">데이터 관리</p>
            <button
              onClick={handleSeed}
              disabled={loading || !userEmail}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {loading ? "처리 중..." : "🌱 테스트 데이터 심기"}
            </button>
            <p className="text-[11px] text-gray-400 leading-tight">
              프로필 + 강점 데이터를 Supabase에 등록해 어느 단계든 바로 진입 가능
            </p>
            <button
              onClick={handleReset}
              disabled={loading || !userEmail}
              className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              🗑️ 데이터 초기화
            </button>
          </div>

          {/* 단계 바로가기 */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500 font-semibold">단계 바로가기</p>
            {ONBOARDING_STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => {
                  setOpen(false);
                  router.push(step.path);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                → {step.label}
              </button>
            ))}
          </div>

          {/* 메시지 */}
          {message && (
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed">
              {message}
            </div>
          )}

          {/* 로그아웃 */}
          {userEmail && (
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-red-500 rounded-lg hover:bg-red-50 transition-colors text-xs font-semibold"
            >
              로그아웃
            </button>
          )}

          <p className="text-[10px] text-gray-300 text-center">
            NEXT_PUBLIC_DEV_MODE=true 일 때만 표시
          </p>
        </div>
      )}
    </>
  );
}
