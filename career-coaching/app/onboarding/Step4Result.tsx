"use client";

import { OnboardingData } from "@/lib/types";

interface Props {
  data: OnboardingData;
}

export default function Step4Result({ data }: Props) {
  return (
    <div className="px-5 py-6 flex flex-col items-center justify-center min-h-[60vh] gap-4 fade-up">
      <div className="w-16 h-16 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="var(--accent)" strokeWidth="2" />
          <path d="M10 16l4 4 8-8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-xl font-700 text-[var(--text-primary)] text-center">
        고민이 명료해졌어요
      </h1>
      <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed">
        {data.name ? `${data.name}님의 ` : ""}코칭 세션이 마무리되었어요.<br />
        다음 단계에서 액션 아이템을 도출해볼게요.
      </p>
      <div className="w-full mt-4 bg-white rounded-2xl border border-[var(--border)] px-4 py-4">
        <p className="text-xs text-[var(--text-muted)] mb-1">진단 결과 준비 중</p>
        <p className="text-sm text-[var(--text-secondary)]">곧 구현될 예정입니다.</p>
      </div>
    </div>
  );
}
