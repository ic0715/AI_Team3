"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NetworkErrorPage() {
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (retryCount >= MAX_RETRIES) return;
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [retryCount]);

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "24px", textAlign: "center", gap: "16px" }}>
      <span style={{ fontSize: "64px" }}>📡</span>
      <h1 style={{ fontSize: "20px", fontWeight: 700 }}>연결이 불안정해요</h1>
      <p style={{ fontSize: "14px", color: "#6B7280" }}>네트워크 상태를 확인해주세요</p>
      {retryCount < MAX_RETRIES && (
        <p aria-live="polite" style={{ fontSize: "12px", color: "#9CA3AF" }}>
          {retryCount + 1}회 재시도 중…
        </p>
      )}
      <button
        onClick={() => setRetryCount(0)}
        style={{ marginTop: "8px", padding: "12px 24px", borderRadius: "999px", background: "#7C3AED", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "15px" }}
      >
        다시 시도
      </button>
      <Link href="/" style={{ fontSize: "14px", color: "#6B7280", textDecoration: "underline" }}>
        처음으로
      </Link>
    </main>
  );
}
