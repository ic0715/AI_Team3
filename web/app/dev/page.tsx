"use client";

/**
 * /dev — 개발자 전용 테스트 대시보드
 *
 * NEXT_PUBLIC_DEV_MODE=true 일 때만 접근 가능.
 * 테스트 계정 로그인, 데이터 세팅, 단계 바로가기 제공.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  ONBOARDING_STEPS,
  MOCK_PROFILE,
  MOCK_STRENGTHS,
  seedTestData,
  resetTestData,
} from "@/lib/dev/seedData";

export default function DevPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEV_EMAIL ?? "");
  const [password, setPassword] = useState(process.env.NEXT_PUBLIC_DEV_PASSWORD ?? "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 개발 모드(npm run dev) 아니면 접근 불가
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        이 페이지는 개발 모드에서만 접근할 수 있어요.
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ email: data.user.email ?? "", id: data.user.id });
    });
  }, []);

  async function handleLogin() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(`❌ 로그인 실패: ${error.message}`);
    } else {
      setUser({ email: data.user.email ?? "", id: data.user.id });
      setMessage("✅ 로그인 성공!");
    }
    setLoading(false);
  }

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
    setUser(null);
    setMessage("로그아웃 완료");
  }

  return (
    <div className="min-h-screen bg-[#e8eaee] flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-md flex flex-col gap-5">

        {/* 헤더 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-2xl font-black text-gray-900 mb-1">🧪 Dev Dashboard</div>
          <div className="text-sm text-gray-500">
            테스트 계정 로그인 → 데이터 심기 → 원하는 단계로 이동하세요
          </div>
          <div className="mt-3 text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2 leading-relaxed">
            ⚠️ 이 페이지는 <strong>npm run dev</strong> 환경에서만 보여요.
            배포(next build) 시에는 자동으로 숨겨져요.
          </div>
        </div>

        {/* 로그인 상태 / 로그인 폼 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="font-bold text-gray-800">1. 로그인</div>

          {user ? (
            <div className="flex flex-col gap-2">
              <div className="bg-green-50 text-green-700 rounded-xl px-3 py-2 text-sm font-semibold">
                ● 로그인됨: {user.email}
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700 text-left"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="테스트 이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {loading ? "로그인 중..." : "테스트 계정으로 로그인"}
              </button>
              <p className="text-xs text-gray-400 leading-relaxed">
                .env.local에 <code>NEXT_PUBLIC_DEV_EMAIL</code>,{" "}
                <code>NEXT_PUBLIC_DEV_PASSWORD</code>를 설정하면 자동으로 채워져요.
                <br />
                테스트 계정은 Supabase 대시보드에서 직접 만들어야 해요.
              </p>
            </div>
          )}
        </div>

        {/* 데이터 세팅 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="font-bold text-gray-800">2. 테스트 데이터 심기</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            로그인 후 이 버튼을 누르면 아래 Mock 데이터가 Supabase에 등록돼요.
            이후 어떤 온보딩 단계든 바로 진입할 수 있어요.
          </p>

          {/* Mock 데이터 미리보기 */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 flex flex-col gap-2">
            <div>
              <span className="font-bold text-gray-700">프로필</span>
              <ul className="mt-1 ml-2 space-y-[2px]">
                <li>닉네임: {MOCK_PROFILE.nickname}</li>
                <li>직군: {MOCK_PROFILE.job_field}</li>
                <li>연차: {MOCK_PROFILE.career_level}</li>
                <li>주요 고민: {MOCK_PROFILE.main_concern}</li>
              </ul>
            </div>
            <div>
              <span className="font-bold text-gray-700">강점 Top 5</span>
              <ul className="mt-1 ml-2 space-y-[2px]">
                {MOCK_STRENGTHS.map((s) => (
                  <li key={s.name_en}>{s.name_ko} ({s.name_en})</li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={handleSeed}
            disabled={loading || !user}
            className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? "처리 중..." : "🌱 테스트 데이터 심기"}
          </button>
          <button
            onClick={handleReset}
            disabled={loading || !user}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-gray-200 transition-colors"
          >
            🗑️ 데이터 초기화 (처음부터 다시)
          </button>
        </div>

        {/* 단계 바로가기 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="font-bold text-gray-800">3. 단계 바로가기</div>
          <p className="text-xs text-gray-500">
            데이터를 심은 후에는 어느 단계든 바로 이동 가능해요.
            데이터 심기 전에 이동하면 이전 단계로 리다이렉트돼요.
          </p>
          <div className="flex flex-col gap-2">
            {ONBOARDING_STEPS.map((step, i) => (
              <button
                key={step.id}
                onClick={() => router.push(step.path)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-semibold text-gray-700 text-left"
              >
                <span className="text-gray-400 text-xs w-4">{i + 1}</span>
                {step.label}
                <span className="ml-auto text-gray-300 text-xs">{step.path}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 메시지 */}
        {message && (
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm text-sm text-gray-700 leading-relaxed">
            {message}
          </div>
        )}

        {/* 설정 안내 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <div className="font-bold text-gray-800">⚙️ 팀원 설정 방법</div>
          <pre className="bg-gray-900 text-green-400 rounded-xl p-3 text-xs leading-relaxed overflow-x-auto">{`# 1. 레포 clone 후 의존성 설치
npm install

# 2. .env.local 파일 생성 후 Supabase 키 입력
# (팀 채널에서 공유된 키를 붙여넣기)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 3. 서버 실행 → Dev Panel 자동 활성화!
npm run dev`}</pre>
          <p className="text-xs text-gray-400 leading-relaxed">
            테스트 계정은 Supabase 대시보드 → Authentication → Users에서 직접 만들어요.
            이메일 인증 확인도 대시보드에서 할 수 있어요.
          </p>
        </div>

      </div>
    </div>
  );
}
