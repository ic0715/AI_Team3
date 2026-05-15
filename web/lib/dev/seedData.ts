/**
 * 개발/테스트용 Mock 데이터 시드 유틸리티
 *
 * - NEXT_PUBLIC_DEV_MODE=true 환경에서만 사용
 * - Supabase에 테스트용 프로필 + 강점 데이터를 심어 온보딩 전 단계를 건너뛸 수 있게 함
 */

import { supabase } from "@/lib/supabase/client";

// ─── Mock 데이터 ───────────────────────────────────────────────

export const MOCK_PROFILE = {
  nickname: "테스터",
  job_field: "IT/개발",
  career_level: "junior",
  main_concern: "커리어 방향",
  profile_completed: true,
};

export const MOCK_STRENGTHS = [
  { name_ko: "실행력", name_en: "Achiever", domain: "executing" },
  { name_ko: "전략적 사고", name_en: "Strategic", domain: "strategic" },
  { name_ko: "분석력", name_en: "Analytical", domain: "strategic" },
  { name_ko: "소통력", name_en: "Communication", domain: "influencing" },
  { name_ko: "공감 능력", name_en: "Empathy", domain: "relationship" },
];

// ─── 시드 함수들 ───────────────────────────────────────────────

/** 현재 로그인 유저의 프로필 + 강점 데이터를 Supabase에 upsert */
export async function seedTestData(): Promise<{ ok: boolean; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "로그인이 필요해요. 먼저 로그인해 주세요." };
  }

  // 1. profiles upsert
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...MOCK_PROFILE }, { onConflict: "id" });

  if (profileError) {
    return { ok: false, message: `프로필 저장 실패: ${profileError.message}` };
  }

  // 2. 기존 strength_analyses is_latest 해제
  await supabase
    .from("strength_analyses")
    .update({ is_latest: false })
    .eq("user_id", user.id);

  // 3. strength_analyses insert
  const { error: strengthError } = await supabase
    .from("strength_analyses")
    .insert({
      user_id: user.id,
      method: "ai_interview",
      strengths: MOCK_STRENGTHS,
      is_latest: true,
    });

  if (strengthError) {
    return { ok: false, message: `강점 저장 실패: ${strengthError.message}` };
  }

  return { ok: true, message: "✅ 프로필 + 강점 데이터 세팅 완료! 어느 단계든 바로 이동할 수 있어요." };
}

/** Supabase 데이터 전체 초기화 (테스트 재시작용) */
export async function resetTestData(): Promise<{ ok: boolean; message: string }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "로그인이 필요해요." };
  }

  await Promise.all([
    supabase.from("career_interview_results").delete().eq("user_id", user.id),
    supabase.from("strength_analyses").delete().eq("user_id", user.id),
    supabase.from("goals").delete().eq("user_id", user.id),
    supabase
      .from("profiles")
      .update({ profile_completed: false })
      .eq("id", user.id),
  ]);

  return { ok: true, message: "🗑️ 데이터 초기화 완료! 처음부터 다시 시작할 수 있어요." };
}
