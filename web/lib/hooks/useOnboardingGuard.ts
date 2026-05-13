"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * 온보딩 각 단계 진입 전 이전 단계 완료 여부를 확인하고,
 * 미완료 시 해당 단계로 리다이렉트한다.
 *
 * 사용 예:
 *   const { ready } = useOnboardingGuard("strengths");
 *   if (!ready) return null;
 */

export type OnboardingStep =
  | "profile"          // p03: 로그인 + 이메일 인증 필요
  | "strengths"        // p04: profile 완료 필요
  | "career-intro"     // p07: 강점 선택 완료 필요
  | "career-interview" // p08: career-intro 통과 필요 (동일 조건)
  | "career-result"    // p09: 커리어 인터뷰 완료 필요
  | "action-items"     // p10: 역량(recommended_competencies) 선택 필요
  | "complete";        // NEW02: 액션 아이템 선택 완료 필요

interface GuardResult {
  ready: boolean; // true이면 현재 페이지 렌더링 허용
}

export function useOnboardingGuard(step: OnboardingStep): GuardResult {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. 세션 확인
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. 이메일 인증 확인
      if (!user.email_confirmed_at) {
        router.replace("/login");
        return;
      }

      // 3. 단계별 이전 완료 조건 확인
      if (step === "profile") {
        // 로그인 + 이메일 인증만 필요 → 통과
        if (!cancelled) setReady(true);
        return;
      }

      // profiles.profile_completed 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", user.id)
        .single();

      if (!profile?.profile_completed) {
        router.replace("/onboarding/profile");
        return;
      }

      if (step === "strengths") {
        if (!cancelled) setReady(true);
        return;
      }

      // strength_analyses (is_latest=true) 확인
      const { data: strengths } = await supabase
        .from("strength_analyses")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_latest", true)
        .limit(1);

      if (!strengths?.length) {
        router.replace("/onboarding/strengths");
        return;
      }

      if (step === "career-intro" || step === "career-interview") {
        if (!cancelled) setReady(true);
        return;
      }

      // career_interview_results 확인
      const { data: interviews } = await supabase
        .from("career_interview_results")
        .select("id, recommended_competencies")
        .eq("user_id", user.id)
        .limit(1);

      if (!interviews?.length) {
        router.replace("/onboarding/career-intro");
        return;
      }

      if (step === "career-result") {
        if (!cancelled) setReady(true);
        return;
      }

      // recommended_competencies 선택 여부 확인
      if (!interviews[0].recommended_competencies) {
        router.replace("/onboarding/career-result");
        return;
      }

      if (step === "action-items") {
        if (!cancelled) setReady(true);
        return;
      }

      // action_items (week_number=1) 확인
      const { data: actions } = await supabase
        .from("action_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_number", 1)
        .limit(1);

      if (!actions?.length) {
        router.replace("/onboarding/action-items");
        return;
      }

      // complete 단계 — 모든 조건 통과
      if (!cancelled) setReady(true);
    }

    check();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready };
}
