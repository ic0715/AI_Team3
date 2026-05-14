/**
 * DevPanelWrapper — 서버 컴포넌트
 *
 * /app/onboarding/ 폴더를 자동으로 스캔해서
 * page.tsx 가 있는 폴더 = 실제 페이지로 인식하고 Dev Panel에 전달.
 *
 * 새 온보딩 페이지를 추가하면 Dev Panel에 자동으로 나타나요.
 * 한국어 이름만 STEP_LABELS에 추가하면 됩니다 (없으면 폴더명이 그대로 표시).
 */

import fs from "fs";
import path from "path";
import DevPanel from "./DevPanel";

// ── 한국어 이름 매핑 ─────────────────────────────────────────
// 새 페이지 추가 시 여기에만 한 줄 추가하면 됩니다.
// 없어도 동작은 하지만, 폴더명(영어)이 그대로 표시돼요.
const STEP_LABELS: Record<string, string> = {
  "profile":            "기본 정보 입력",
  "strengths":          "강점 선택",
  "career-intro":       "커리어 인터뷰 인트로",
  "career-interview":   "커리어 인터뷰",
  "career-result":      "커리어 방향 결과",
  "action-items":       "액션 아이템 선택",
  "complete":           "온보딩 완료",
};

// ── 표시 순서 ─────────────────────────────────────────────────
// 목록에 없는 페이지는 마지막에 알파벳 순으로 자동 추가돼요.
const STEP_ORDER = [
  "profile",
  "strengths",
  "career-intro",
  "career-interview",
  "career-result",
  "action-items",
  "complete",
];

export default function DevPanelWrapper() {
  if (process.env.NODE_ENV !== "development") return null;

  // /app/onboarding/ 하위 폴더 중 page.tsx 가 있는 것만 수집
  const onboardingDir = path.join(process.cwd(), "app", "onboarding");
  let steps: { id: string; label: string; path: string }[] = [];

  try {
    const dirs = fs.readdirSync(onboardingDir, { withFileTypes: true });
    const found = dirs
      .filter(
        (d) =>
          d.isDirectory() &&
          fs.existsSync(path.join(onboardingDir, d.name, "page.tsx"))
      )
      .map((d) => ({
        id: d.name,
        label: STEP_LABELS[d.name] ?? d.name, // 매핑 없으면 폴더명 그대로
        path: `/onboarding/${d.name}`,
      }));

    // STEP_ORDER 기준으로 정렬, 목록에 없는 건 뒤에 추가
    steps = [
      ...STEP_ORDER.filter((id) => found.some((s) => s.id === id)).map(
        (id) => found.find((s) => s.id === id)!
      ),
      ...found
        .filter((s) => !STEP_ORDER.includes(s.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ];
  } catch {
    // onboarding 폴더가 없으면 빈 배열로 진행
  }

  return <DevPanel steps={steps} />;
}
