"use client";

import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: ErrorPageProps) {
  useEffect(() => {
    // TODO: Sentry.captureException(error)
    console.error(error);
  }, [error]);

  const errorId = error.digest ?? "unknown";

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "24px", textAlign: "center", gap: "16px" }}>
      <span style={{ fontSize: "64px" }}>⚠️</span>
      <h1 aria-live="assertive" style={{ fontSize: "20px", fontWeight: 700 }}>
        예상치 못한 문제가 발생했어요
      </h1>
      <p style={{ fontSize: "14px", color: "#6B7280" }}>잠시 후 다시 시도해주세요</p>
      <p style={{ fontSize: "11px", color: "#9CA3AF", userSelect: "all" }}>오류 ID: {errorId}</p>
      <Link
        href="/"
        style={{ marginTop: "8px", padding: "12px 24px", borderRadius: "999px", background: "#7C3AED", color: "#fff", fontWeight: 700, fontSize: "15px", textDecoration: "none" }}
      >
        처음으로
      </Link>
      <a href="mailto:support@careerpt.app" style={{ fontSize: "14px", color: "#6B7280", textDecoration: "underline" }}>
        고객센터 문의
      </a>
    </main>
  );
}
