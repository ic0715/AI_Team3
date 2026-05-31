'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TabBar } from '@/components/ui/TabBar';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { calculateCurrentWeek } from '@/lib/utils/week';

// ────────────────────────────────────────────────────────────
// 14 프로필 (스펙 v1.2)
//
// 진입: 탭바 [프로필]
// 기능: 정보 조회/인라인 수정 + 강점 + 커리어 방향 재설정 + 비밀번호 변경 + 로그아웃/탈퇴
// ────────────────────────────────────────────────────────────

interface ProfileData {
  nickname: string;
  email: string;
  jobField: string;
  careerLevel: string;
}

interface Strength {
  name_ko: string;
  name_en: string;
  domain?: string;
}

interface ActiveGoal {
  id: string;
  goal_title: string;
  /** v1.5: started_at 기준 계산된 현재 주차 */
  current_week: number;
  started_at: string | null;
}

// 03 페이지와 동일한 옵션 set (DB-level values)
const JOB_OPTIONS = [
  'IT/개발', '디자인', '기획/PM', '마케팅/영업', 'HR/인사',
  '재무/회계', '교육', '의료/보건', '제조/생산', '학생', '기타',
];

const CAREER_OPTIONS = [
  { value: 'junior_new', label: '신입 (0년)' },
  { value: 'junior',     label: '주니어 (1~3년)' },
  { value: 'senior_mid', label: '미드 (4~7년)' },
  { value: 'senior',     label: '시니어 (8년+)' },
];

function careerLabel(value: string): string {
  return CAREER_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingScreen text="프로필을 불러오는 중..." />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [strengths, setStrengths] = useState<Strength[]>([]);
  const [goal, setGoal] = useState<ActiveGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 인라인 편집 모드
  const [isEditMode, setIsEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editJobField, setEditJobField] = useState('');
  const [editCareerLevel, setEditCareerLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // 다이얼로그
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'first' | 'second' | null>(null);

  // ── 데이터 로드 ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (cancelled) return;

        const [profileRes, strengthRes, goalRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('nickname, job_field, career_level')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('strength_analyses')
            .select('strengths')
            .eq('user_id', user.id)
            .eq('is_latest', true)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('goals')
            // v1.5: started_at 포함 — 주차 계산에 사용
            .select('id, goal_title, current_week, started_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (profileRes.error) console.error('[14] profiles:', profileRes.error);
        if (strengthRes.error) console.error('[14] strength_analyses:', strengthRes.error);
        if (goalRes.error) console.error('[14] goals:', goalRes.error);

        const p: ProfileData = {
          nickname: profileRes.data?.nickname ?? '',
          email: user.email ?? '',
          jobField: profileRes.data?.job_field ?? '',
          careerLevel: profileRes.data?.career_level ?? '',
        };
        setProfile(p);
        setEditNickname(p.nickname);
        setEditJobField(p.jobField);
        setEditCareerLevel(p.careerLevel);

        setStrengths((strengthRes.data?.strengths as Strength[] | undefined) ?? []);
        // v1.5: DB의 current_week 무시하고 started_at 기준 계산
        const goalRow = goalRes.data as ActiveGoal | undefined;
        const goalWithCalcWeek: ActiveGoal | null = goalRow
          ? { ...goalRow, current_week: calculateCurrentWeek(goalRow.started_at) }
          : null;
        setGoal(goalWithCalcWeek);
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('프로필을 불러올 수 없어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  // ── 기본 정보 수정 ────────────────────────────────────────
  const handleStartEdit = useCallback(() => {
    if (!profile) return;
    setEditNickname(profile.nickname);
    setEditJobField(profile.jobField);
    setEditCareerLevel(profile.careerLevel);
    setIsEditMode(true);
  }, [profile]);

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!profile || saving) return;
    if (!editNickname.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          nickname: editNickname.trim(),
          job_field: editJobField,
          career_level: editCareerLevel,
        })
        .eq('id', user.id);
      if (upErr) throw upErr;

      setProfile({
        ...profile,
        nickname: editNickname.trim(),
        jobField: editJobField,
        careerLevel: editCareerLevel,
      });
      setIsEditMode(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      console.error('[14] save profile:', e);
      setError('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [profile, saving, editNickname, editJobField, editCareerLevel]);

  // ── 커리어 방향 재설정 ────────────────────────────────────
  const handleConfirmReset = useCallback(async () => {
    if (!goal || resetting) return;
    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const { error: upErr } = await supabase
        .from('goals')
        .update({ status: 'abandoned' })
        .eq('id', goal.id)
        .eq('user_id', user.id);
      if (upErr) throw upErr;

      router.push('/onboarding/career-intro');
    } catch (e) {
      console.error('[14] reset goal:', e);
      setError('재설정에 실패했어요. 다시 시도해주세요.');
      setResetting(false);
      setShowResetConfirm(false);
    }
  }, [goal, resetting, router]);

  // ── 로그아웃 ──────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[14] signOut:', e);
    }
    // localStorage MVP flag 정리 (NEW02 재진입 차단 플래그)
    try { localStorage.removeItem('mvp_completed'); } catch { /* ignore */ }
    router.push('/');
  }, [router]);

  // ── 회원 탈퇴 ────────────────────────────────────────────
  // MVP 단계 — 실제 데이터 삭제는 서버 사이드 admin API 필요. 우선 signOut + 토스트.
  const handleDeleteAccount = useCallback(async () => {
    try {
      // TODO: 서버 라우트 /api/account/delete 만들어서 cascade delete + auth.admin.deleteUser
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[14] delete account:', e);
    }
    try { localStorage.removeItem('mvp_completed'); } catch { /* ignore */ }
    router.push('/');
  }, [router]);

  // ── 렌더 분기 ─────────────────────────────────────────────
  if (loading) return <LoadingScreen text="프로필을 불러오는 중..." />;
  if (!profile) return <LoadingScreen text={error ?? '프로필을 찾을 수 없어요.'} />;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={topbarStyle}>
        <div style={brandStyle}>
          CareerPT
          <sup style={brandDotStyle}>·</sup>
        </div>
        <span style={stepPillStyle}>👤 프로필</span>
      </header>

      <main style={screenStyle}>
        {/* 히어로 카드 (아바타 영역 제거 — v1.4) */}
        <section style={heroCardStyle}>
          <div style={heroNameStyle}>{profile.nickname || '닉네임 미설정'}</div>
          <div style={heroEmailStyle}>{profile.email}</div>
          <div style={heroBadgeRowStyle}>
            <span style={heroBadgeStyle}>
              {profile.jobField || '직무 미설정'} · {careerLabel(profile.careerLevel)}
            </span>
          </div>
        </section>

        {error && (
          <div role="alert" style={errorAlertStyle}>
            {error}
          </div>
        )}

        {/* 강점 Top 5 섹션 */}
        <section style={sectionCardStyle}>
          <div style={sectionTitleStyle}>⭐ 내 강점 Top 5</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 14px' }}>
            {strengths.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--ink-mute)' }}>
                아직 분석된 강점이 없어요
              </span>
            ) : (
              strengths.slice(0, 5).map((s, i) => (
                <span key={`${s.name_en}-${i}`} style={strengthChipStyle}>
                  {s.name_ko}
                </span>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push('/onboarding/strengths?from=profile')}
            style={menuItemStyle}
          >
            <span style={menuIconStyle}>✏️</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={menuTitleStyle}>강점 수정</div>
              <div style={menuSubStyle}>다른 강점 5개로 다시 선택할 수 있어요</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>›</span>
          </button>
        </section>

        {/* 커리어 방향 섹션 */}
        <section style={sectionCardStyle}>
          <div style={sectionTitleStyle}>🎯 커리어 방향</div>
          <div style={{ padding: '0 16px 14px' }}>
            {goal ? (
              <>
                <div style={goalTitleStyle}>{goal.goal_title}</div>
                <div style={goalSubStyle}>
                  역량 목표 {goal.current_week}주차 진행 중이에요. ✨
                </div>
              </>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--ink-mute)' }}>
                아직 설정된 커리어 방향이 없어요
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            style={menuItemStyle}
          >
            <span style={menuIconStyle}>🔄</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={menuTitleStyle}>커리어 방향 재설정</div>
              <div style={menuSubStyle}>언제든 다시 인터뷰할 수 있어요</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>›</span>
          </button>
        </section>

        {/* 기본 정보 섹션 */}
        <section style={sectionCardStyle}>
          <div style={sectionTitleWithActionStyle}>
            <span>📋 기본 정보</span>
            {!isEditMode && (
              <button
                type="button"
                onClick={handleStartEdit}
                style={{
                  ...editBtnStyle,
                  color: savedFlash ? 'var(--success)' : 'var(--ink-soft)',
                  borderColor: savedFlash ? 'var(--success)' : 'var(--line-strong)',
                }}
              >
                {savedFlash ? '✓ 저장됨' : '수정'}
              </button>
            )}
          </div>

          {!isEditMode ? (
            <>
              <InfoRow label="닉네임" value={profile.nickname || '—'} />
              <InfoRow label="직업/분야" value={profile.jobField || '—'} />
              <InfoRow label="경력" value={careerLabel(profile.careerLevel) || '—'} />
            </>
          ) : (
            <div style={editFormStyle}>
              <div style={{ marginBottom: '12px' }}>
                <label style={editLabelStyle}>닉네임</label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  maxLength={10}
                  style={editInputStyle}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={editLabelStyle}>직업/분야</label>
                <select
                  value={editJobField}
                  onChange={(e) => setEditJobField(e.target.value)}
                  style={editInputStyle}
                >
                  <option value="" disabled>
                    선택해주세요
                  </option>
                  {JOB_OPTIONS.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={editLabelStyle}>경력</label>
                <select
                  value={editCareerLevel}
                  onChange={(e) => setEditCareerLevel(e.target.value)}
                  style={editInputStyle}
                >
                  <option value="" disabled>
                    선택해주세요
                  </option>
                  {CAREER_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{ ...formBtnStyle, ...formBtnCancelStyle }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving || !editNickname.trim()}
                  style={{
                    ...formBtnStyle,
                    ...formBtnPrimaryStyle,
                    opacity: saving || !editNickname.trim() ? 0.5 : 1,
                  }}
                >
                  {saving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 설정 섹션 */}
        <section style={sectionCardStyle}>
          <div style={sectionTitleStyle}>⚙️ 설정</div>
          <button
            type="button"
            onClick={() => router.push('/profile/password-change')}
            style={menuItemStyle}
          >
            <span style={menuIconStyle}>🔒</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={menuTitleStyle}>비밀번호 변경</div>
              <div style={menuSubStyle}>안전한 비밀번호로 업데이트</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>›</span>
          </button>
        </section>

        {/* Danger Zone */}
        <section style={{ ...sectionCardStyle, marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            style={dangerBtnStyle}
          >
            🚪 로그아웃
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm('first')}
            style={{ ...dangerBtnStyle, opacity: 0.65 }}
          >
            ⚠️ 회원 탈퇴
          </button>
        </section>

        <div style={versionTextStyle}>CareerPT v0.1.0</div>
      </main>

      <TabBar active="profile" />

      {/* 다이얼로그들 */}
      {showResetConfirm && (
        <ConfirmDialog
          title="커리어 방향을 다시 설정할까요?"
          desc="현재 목표가 종료되고, 인터뷰부터 다시 진행해요."
          confirmText={resetting ? '진행 중...' : '재설정'}
          cancelText="취소"
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetConfirm(false)}
          confirmDisabled={resetting}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmDialog
          title="로그아웃 할까요?"
          desc="다시 로그인하시면 이전 데이터 그대로 이어갈 수 있어요."
          confirmText="로그아웃"
          cancelText="취소"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showDeleteConfirm === 'first' && (
        <ConfirmDialog
          title="정말 탈퇴하시겠어요?"
          desc="모든 회고·강점·코칭 데이터가 영구히 삭제돼요. 복구할 수 없어요."
          confirmText="계속"
          cancelText="취소"
          danger
          onConfirm={() => setShowDeleteConfirm('second')}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showDeleteConfirm === 'second' && (
        <ConfirmDialog
          title="마지막 확인이에요"
          desc="이 작업은 되돌릴 수 없어요. 정말 삭제할까요?"
          confirmText="삭제"
          cancelText="취소"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoKeyStyle}>{label}</span>
      <span style={infoValStyle}>{value}</span>
    </div>
  );
}

function ConfirmDialog({
  title,
  desc,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  danger = false,
  confirmDisabled = false,
}: {
  title: string;
  desc: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  confirmDisabled?: boolean;
}) {
  return (
    <div role="dialog" aria-modal="true" style={dialogOverlayStyle}>
      <div style={dialogBoxStyle}>
        <div style={dialogTitleStyle}>{title}</div>
        <p style={dialogDescStyle}>{desc}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onCancel} style={dialogBtnCancelStyle}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={danger ? dialogBtnDangerStyle : dialogBtnPrimaryStyle}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  height: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
  position: 'relative',
};

const topbarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px 14px',
  background: 'var(--bg)',
  flexShrink: 0,
};

const brandStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: '18px',
  letterSpacing: '-.02em',
  color: 'var(--ink)',
};

const brandDotStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--accent)',
};

const stepPillStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--accent)',
  padding: '5px 12px',
  borderRadius: '999px',
  background: 'var(--accent-tint)',
  fontWeight: 700,
};

const screenStyle: CSSProperties = {
  padding: '8px 22px 24px',
  flex: 1,
  overflowY: 'auto',
};

const heroCardStyle: CSSProperties = {
  background: 'var(--accent)',
  borderRadius: '22px',
  padding: '24px 20px',
  color: '#fff',
  textAlign: 'center',
  marginBottom: '16px',
  boxShadow: '0 6px 20px -8px rgba(45,91,255,.4)',
};

const heroNameStyle: CSSProperties = {
  fontSize: '22px',
  fontWeight: 800,
  marginBottom: '4px',
  letterSpacing: '-.02em',
};

const heroEmailStyle: CSSProperties = {
  fontSize: '12.5px',
  opacity: 0.85,
  marginBottom: '10px',
};

const heroBadgeRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '6px',
  flexWrap: 'wrap',
};

const heroBadgeStyle: CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 600,
  padding: '4px 10px',
  background: 'rgba(255,255,255,.18)',
  color: '#fff',
  borderRadius: '999px',
};

const sectionCardStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  borderRadius: '18px',
  marginBottom: '14px',
  overflow: 'hidden',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--ink)',
  padding: '16px 16px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const sectionTitleWithActionStyle: CSSProperties = {
  ...sectionTitleStyle,
  justifyContent: 'space-between',
};

const editBtnStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  padding: '4px 12px',
  borderRadius: '999px',
  border: '1px solid var(--line-strong)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const strengthChipStyle: CSSProperties = {
  fontSize: '12.5px',
  fontWeight: 700,
  padding: '6px 12px',
  background: '#fff',
  color: 'var(--accent)',
  border: '1px solid var(--accent-soft)',
  borderRadius: '999px',
};

const goalTitleStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 800,
  color: 'var(--accent)',
  marginBottom: '4px',
  lineHeight: 1.4,
};

const goalSubStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--ink-soft)',
};

const menuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  border: 'none',
  borderTop: '1px solid var(--line)',
  cursor: 'pointer',
  width: '100%',
  background: '#fff',
  fontFamily: 'inherit',
  transition: 'background .12s',
};

const menuIconStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  background: 'var(--accent-tint)',
  flexShrink: 0,
};

const menuTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--ink)',
};

const menuSubStyle: CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--ink-mute)',
  marginTop: '2px',
};

const infoRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '13px 16px',
  background: '#fff',
  borderTop: '1px solid var(--line)',
};

const infoKeyStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--ink-mute)',
  fontWeight: 500,
};

const infoValStyle: CSSProperties = {
  fontSize: '13.5px',
  fontWeight: 700,
  color: 'var(--ink)',
};

const editFormStyle: CSSProperties = {
  padding: '14px 16px',
  borderTop: '1px solid var(--line)',
  background: '#fff',
};

const editLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  marginBottom: '6px',
};

const editInputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--line-strong)',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'inherit',
  background: '#fff',
  color: 'var(--ink)',
  outline: 'none',
};

const formBtnStyle: CSSProperties = {
  flex: 1,
  padding: '11px',
  borderRadius: '10px',
  fontFamily: 'inherit',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  border: '1px solid var(--line-strong)',
};

const formBtnCancelStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  color: 'var(--ink)',
};

const formBtnPrimaryStyle: CSSProperties = {
  flex: 2,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  fontWeight: 700,
};

const dangerBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 16px',
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
  background: '#fff',
  border: 'none',
  fontFamily: 'inherit',
  textAlign: 'left',
  borderTop: '1px solid var(--line)',
  transition: 'background .12s',
};

const versionTextStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--ink-mute)',
  textAlign: 'center',
  marginTop: '20px',
};

const errorAlertStyle: CSSProperties = {
  padding: '10px 14px',
  marginBottom: '12px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

// Dialog styles
const dialogOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '24px',
};

const dialogBoxStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '20px',
  padding: '24px',
  width: '100%',
  maxWidth: '340px',
};

const dialogTitleStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  marginBottom: '8px',
  color: 'var(--ink)',
};

const dialogDescStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: '14px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
};

const dialogBtnCancelStyle: CSSProperties = {
  flex: 1,
  padding: '13px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
};

const dialogBtnPrimaryStyle: CSSProperties = {
  flex: 1,
  padding: '13px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
};

const dialogBtnDangerStyle: CSSProperties = {
  ...dialogBtnPrimaryStyle,
  background: '#dc2626',
};
