/**
 * /dev — 개발자 전용 테스트 대시보드 (Server Component)
 *
 * NODE_ENV=development (npm run dev) 일 때만 접근 가능.
 * /app/onboarding/ 폴더를 자동 스캔해서 단계 목록을 DevPageClient에 전달.
 * 새 온보딩 페이지를 추가하면 자동으로 목록에 나타남.
 */

import fs from "fs";
import path from "path";
import DevPageClient from "./DevPageClient";

// ── 한국어 이름 매핑 ─────────────────────────────────────────
// 새 페이지 추가 시 여기에만 한 줄 추가하면 됩니다.
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
const STEP_ORDER = [
  "profile",
  "strengths",
  "career-intro",
  "career-interview",
  "career-result",
  "action-items",
  "complete",
];

export default function DevPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        이 페이지는 개발 모드에서만 접근할 수 있어요.
      </div>
    );
  }

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
        label: STEP_LABELS[d.name] ?? d.name,
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

  return <DevPageClient steps={steps} />;
}
