'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { STRENGTHS_BY_DOMAIN, type Strength } from '@/lib/constants/strengths';

// ── 로컬스토리지 키 ───────────────────────────────────────────
const LS_KEY = 'selectedStrengths';

// ── 선택된 강점 타입 ──────────────────────────────────────────
interface SelectedStrength {
  id: string;
  name: string;
  nameEn: string;
  domain: string;
}

// ── 도메인 색상 매핑 ──────────────────────────────────────────
const DOMAIN_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  executing:    { color: '#7C3AED', bg: '#F3EEFF', border: '#C4B5FD' },
  influencing:  { color: '#EA580C', bg: '#FFF1E6', border: '#FDBA74' },
  relationship: { color: '#2563EB', bg: '#E6EFFF', border: '#93C5FD' },
  strategic:    { color: '#059669', bg: '#E3F8EE', border: '#86EFAC' },
};

// ── 페이지 래퍼 (Suspense 경계) ───────────────────────────────
export default function StrengthsPage() {
  return (
    <Suspense
      fallback={
        <div style={wrapStyle}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>불러오는 중...</div>
          </div>
        </div>
      }
    >
      <StrengthsContent />
    </Suspense>
  );
}

// ── 메인 컨텐츠 ───────────────────────────────────────────────
function StrengthsContent() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedStrength[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 인증 체크 + localStorage 복원
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
    };
    init();

    // localStorage에서 이전 선택 복원
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SelectedStrength[];
        if (Array.isArray(parsed) && parsed.length <= 5) {
          setSelected(parsed);
        }
      }
    } catch {
      // localStorage 파싱 실패는 무시
    }

    // 언마운트 시 디바운스 타이머 정리
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [router]);

  // 칩 토글 핸들러
  const handleToggle = useCallback((strength: Strength) => {
    setSelected((prev) => {
      const alreadySelected = prev.some((s) => s.id === strength.id);

      if (alreadySelected) {
        // 선택 해제
        const next = prev.filter((s) => s.id !== strength.id);
        scheduleLocalSave(next, saveTimerRef);
        return next;
      }

      // 5개 이미 선택 → 추가 불가
      if (prev.length >= 5) return prev;

      const next = [
        ...prev,
        { id: strength.id, name: strength.name, nameEn: strength.nameEn, domain: strength.domain },
      ];
      scheduleLocalSave(next, saveTimerRef);
      return next;
    });
  }, []);

  // 저장 + 이동
  const handleSubmit = async () => {
    if (selected.length !== 5 || saving) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const strengthsPayload = selected.map((s, idx) => ({
        rank: idx + 1,
        name_ko: s.name,
        name_en: s.nameEn,
        domain: s.domain,
      }));

      const { error: dbError } = await supabase.from('strength_analyses').insert({
        user_id: user.id,
        method: 'direct_select',
        strengths: strengthsPayload,
        is_latest: true,
      });

      if (dbError) throw dbError;

      // 다음 화면에서 prefill용 localStorage 보존
      localStorage.setItem(LS_KEY, JSON.stringify(
        selected.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, domain: s.domain }))
      ));

      router.push('/onboarding/career-intro');
    } catch (err) {
      console.error(err);
      setError('저장에 실패했어요. 다시 시도해주세요.');
      setSaving(false);
    }
  };

  const count = selected.length;
  const isFull = count === 5;
  const canSubmit = isFull && !saving;

  return (
    <div style={wrapStyle}>
      {/* ── 상단 바 ── */}
      <header style={headerStyle}>
        <button
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          style={backBtnStyle}
        >
          ←
        </button>
        <span style={pageTitleStyle}>강점 선택</span>
        <span style={{ width: '36px' }} />
      </header>

      {/* ── 프로그레스 바 ── */}
      <div style={progressWrapStyle}>
        <div style={progressLabelStyle}>2 / 5 단계</div>
        <div style={progressBarStyle}>
          <div style={{ ...progressFillStyle, width: '40%' }} />
        </div>
      </div>

      {/* ── 스크롤 본문 ── */}
      <main style={mainStyle}>
        {/* 인트로 */}
        <div style={{ marginBottom: '28px' }}>
          <div style={eyebrowStyle}>STEP 2</div>
          <h1 style={titleStyle}>
            나의 강점 <strong>5가지</strong>를 골라주세요 💡
          </h1>
          <p style={descStyle}>
            강점은 갤럽 클리프턴 스트렝스 34개 테마를 기반으로 해요.
          </p>
        </div>

        {/* 도메인 섹션 × 4 */}
        {STRENGTHS_BY_DOMAIN.map((domain) => {
          const ds = DOMAIN_STYLES[domain.key];
          return (
            <section
              key={domain.key}
              role="group"
              aria-labelledby={`domain-${domain.key}`}
              style={{
                marginBottom: '20px',
                borderRadius: '16px',
                border: `1.5px solid ${ds.border}`,
                padding: '16px 16px 14px',
                background: '#fff',
              }}
            >
              {/* 도메인 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: ds.color, flexShrink: 0,
                  }}
                />
                <h2
                  id={`domain-${domain.key}`}
                  style={{
                    fontSize: '16px', fontWeight: 800,
                    color: ds.color, flex: 1,
                    letterSpacing: '-.02em', margin: 0,
                  }}
                >
                  {domain.label}
                  <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7, marginLeft: '4px', letterSpacing: '.02em' }}>
                    {domain.labelEn}
                  </span>
                </h2>
                <span
                  style={{
                    fontSize: '11px', fontWeight: 700,
                    color: ds.color, background: ds.bg,
                    padding: '3px 9px', borderRadius: '999px', flexShrink: 0,
                  }}
                >
                  {domain.strengths.length}개
                </span>
              </div>

              {/* 도메인 설명 */}
              <p style={{
                fontSize: '12.5px', color: 'var(--text-secondary)',
                lineHeight: 1.6, marginBottom: '14px',
                letterSpacing: '-.005em',
              }}>
                {domain.description}
              </p>

              {/* 강점 칩 그리드 */}
              <div
                role="group"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}
              >
                {domain.strengths.map((strength) => {
                  const isSelected = selected.some((s) => s.id === strength.id);
                  const isDisabled = isFull && !isSelected;

                  return (
                    <button
                      key={strength.id}
                      aria-pressed={isSelected}
                      disabled={isDisabled}
                      onClick={() => handleToggle(strength)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: `1.5px solid ${isSelected ? ds.color : ds.border}`,
                        background: isSelected ? ds.color : '#fff',
                        color: isSelected ? '#fff' : ds.color,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.4 : 1,
                        transition: 'all .15s',
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isSelected ? '0 3px 10px -2px rgba(0,0,0,.15)' : 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled && !isSelected) {
                          e.currentTarget.style.background = ds.bg;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled && !isSelected) {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {strength.name}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* ── 하단 카운터 + CTA ── */}
      <footer style={footerStyle}>
        {/* 에러 메시지 */}
        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: '12px',
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: '10px', fontSize: '13px',
            color: 'var(--danger)', fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* 카운터 */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            textAlign: 'center', marginBottom: '12px',
            fontSize: '14px', fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          선택한 강점{' '}
          <strong style={{ color: isFull ? 'var(--accent)' : 'var(--text-primary)', fontSize: '16px' }}>
            {count}
          </strong>
          {' '}/ 5
        </div>

        {/* CTA 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', minHeight: '54px', padding: '16px 18px',
            borderRadius: '12px',
            background: canSubmit ? 'var(--accent)' : 'var(--border)',
            color: canSubmit ? '#fff' : 'var(--text-muted)',
            border: 'none', fontFamily: 'inherit',
            fontSize: '15.5px', fontWeight: 800, letterSpacing: '-.02em',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background .2s, transform .1s',
          }}
          onMouseOver={(e) => { if (canSubmit) e.currentTarget.style.background = 'var(--accent-deep)'; }}
          onMouseOut={(e) => { if (canSubmit) e.currentTarget.style.background = 'var(--accent)'; }}
          onMouseDown={(e) => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.99)'; }}
          onMouseUp={(e) => { if (canSubmit) e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {saving ? '저장 중...' : '다음으로 →'}
        </button>
      </footer>
    </div>
  );
}

// ── localStorage 디바운스 저장 헬퍼 ──────────────────────────
function scheduleLocalSave(
  data: SelectedStrength[],
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      // 무시
    }
  }, 200);
}

// ── 공통 스타일 ───────────────────────────────────────────────
const wrapStyle: React.CSSProperties = {
  width: '390px',
  minHeight: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflowX: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '16px 20px',
  gap: '12px',
  position: 'sticky',
  top: 0,
  background: 'var(--surface)',
  zIndex: 10,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const backBtnStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '20px',
  fontFamily: 'inherit',
  flexShrink: 0,
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  flex: 1,
  textAlign: 'center',
};

const progressWrapStyle: React.CSSProperties = {
  padding: '10px 20px 6px',
  background: 'var(--surface)',
  flexShrink: 0,
};

const progressLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  marginBottom: '6px',
};

const progressBarStyle: React.CSSProperties = {
  height: '4px',
  background: 'var(--border)',
  borderRadius: '999px',
  overflow: 'hidden',
};

const progressFillStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--accent)',
  borderRadius: '999px',
  transition: 'width .4s ease',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '24px 20px',
};

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: '8px',
  padding: '5px 13px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '.08em',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  color: 'var(--text-primary)',
  fontSize: '22px',
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-.035em',
};

const descStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: 1.7,
  letterSpacing: '-.005em',
};

const footerStyle: React.CSSProperties = {
  padding: '16px 20px',
  paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
  borderTop: '1px solid var(--border)',
  background: 'var(--surface)',
  flexShrink: 0,
};
