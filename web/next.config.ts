import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Next.js의 파일 추적 범위를 web/ 밖(repo 루트)까지 확장.
  // AI 프롬프트 라우트들이 ../docs/ai_prompt/*.md 풀텍스트를 fs.readFileSync로 로드함.
  // 기본 추적은 web/ 안만 보므로 Vercel 함수 번들에 docs/가 빠져 ENOENT 발생.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/career-interview/**/*": ["../docs/ai_prompt/**/*"],
    "/api/career-personalize/**/*": ["../docs/ai_prompt/**/*"],
    "/api/career-actions/**/*": ["../docs/ai_prompt/**/*"],
    "/api/reflect-coach/**/*": ["../docs/ai_prompt/**/*"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 개발 환경에서는 서비스워커 비활성화
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
