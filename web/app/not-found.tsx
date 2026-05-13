import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "24px", textAlign: "center", gap: "16px" }}>
      <span style={{ fontSize: "64px" }}>🗺️</span>
      <h1 style={{ fontSize: "20px", fontWeight: 700 }}>찾을 수 없는 페이지에요</h1>
      <p style={{ fontSize: "14px", color: "#6B7280" }}>주소를 다시 확인해주세요</p>
      <Link
        href="/"
        style={{ marginTop: "8px", padding: "12px 24px", borderRadius: "999px", background: "#7C3AED", color: "#fff", fontWeight: 700, fontSize: "15px", textDecoration: "none" }}
      >
        처음으로
      </Link>
    </main>
  );
}
