"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * 온보딩 각 단계 진입 전 이전 단계 완료 여부를 확인하고,
 * 미완료 시 사용자에게 안내 후 해당 단계로 이동한다.
 *
 * 사용 예:
 *   const { ready, pendingRedirect, confirmRedirect } = useOnboardingGuard("strengths");
 *   if (pendingRedirect) return <OnboardingRedirectModal {...pendingRedirect} onConfirm={confirmRedirect} />;
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

export interface PendingRedirect {
  to: string;
  title: string;
  message: string;
}

interface GuardResult {
  ready: boolean;
  pendingRedirect: PendingRedirect | null;
  confirmRedirect: () => void;
}

export function useOnboardingGuard(step: OnboardingStep): GuardResult {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<PendingRedirect | null>(null);

  const confirmRedirect = useCallback(() => {
    if (pendingRedirect) {
      router.replace(pendingRedirect.to);
    }
  }, [pendingRedirect, router]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. 세션 확인 — 보안 리다이렉트는 바로 이동 (확인 불필요)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. 이메일 인증 확인 — 보안 리다이렉트
      if (!user.email_confirmed_at) {
        router.replace("/login");
        return;
      }

      // 3. 단계별 이전 완료 조건 확인
      if (step === "profile") {
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
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/profile",
          title: "기본정보 입력이 필요해요",
          message: "이 단계를 이용하려면 기본정보 입력을 먼저 완료해야 해요.\n기본정보 입력 화면으로 이동할게요.",
        });
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
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/strengths",
          title: "강점 선택이 필요해요",
          message: "이 단계를 이용하려면 나의 Top 5 강점 선택을 먼저 완료해야 해요.\n강점 선택 화면으로 이동할게요.",
        });
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
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/career-intro",
          title: "커리어 인터뷰가 필요해요",
          message: "이 단계를 이용하려면 AI 커리어 인터뷰를 먼저 완료해야 해요.\n인터뷰 시작 화면으로 이동할게요.",
        });
        return;
      }

      if (step === "career-result") {
        if (!cancelled) setReady(true);
        return;
      }

      // recommended_competencies 선택 여부 확인
      if (!interviews[0].recommended_competencies) {
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/career-result",
          title: "목표 방향 선택이 필요해요",
          message: "이 단계를 이용하려면 커리어 목표 방향 선택을 먼저 완료해야 해요.\n목표 선택 화면으로 이동할게요.",
        });
        return;
      }

      // goal 존재 여부 확인 — recommended_competencies만 있고 goal이 없으면
      // action-items 대신 career-result로 보냄 (goal 선택이 선행 필요)
      const { data: goals } = await supabase
        .from("goals")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .limit(1);

      if (!goals?.length) {
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/career-result",
          title: "커리어 목표 선택이 필요해요",
          message: "이 단계를 이용하려면 커리어 목표 방향을 먼저 선택해야 해요.\n목표 선택 화면으로 이동할게요.",
        });
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
        if (!cancelled) setPendingRedirect({
          to: "/onboarding/action-items",
          title: "액션 아이템 선택이 필요해요",
          message: "이 단계를 이용하려면 첫 번째 액션 아이템 선택을 먼저 완료해야 해요.\n액션 아이템 선택 화면으로 이동할게요.",
        });
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

  return { ready, pendingRedirect, confirmRedirect };
}
