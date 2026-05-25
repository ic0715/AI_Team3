'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// ── 상수 ──────────────────────────────────────────────────────
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

const GENDER_OPTIONS = [
  { value: '남성', label: '남성' },
  { value: '여성', label: '여성' },
  { value: '기타', label: '기타' },
  { value: '응답 안 함', label: '응답 안 함' },
];

// 만 14세 이상 기준 max 날짜 동적 계산
function getMaxBirthdate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 14);
  return d.toISOString().split('T')[0];
}

// ── 컴포넌트 ──────────────────────────────────────────────────
export default function BasicInfoPage() {
  return (
    <Suspense fallback={
      <div style={wrapStyle}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>불러오는 중...</div>
        </div>
      </div>
    }>
      <BasicInfoContent />
    </Suspense>
  );
}

function BasicInfoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?mode=edit → 수정 모드 (15 프로필 또는 NEW03에서 진입)
  const isEditMode = searchParams.get('mode') === 'edit';

  // 폼 상태
  const [nickname, setNickname] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [jobField, setJobField] = useState('');
  const [careerLevel, setCareerLevel] = useState('');
  const [mainConcern, setMainConcern] = useState('');

  // 에러 상태
  const [nicknameError, setNicknameError] = useState('');
  const [birthdateError, setBirthdateError] = useState('');
  const [jobError, setJobError] = useState('');
  const [careerError, setCareerError] = useState('');

  // 기타 상태
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 수정 모드: 원본 값 저장 (변경 여부 감지용)
  const originalValues = useRef({ nickname: '', gender: '', jobField: '', careerLevel: '', mainConcern: '' });

  // 닉네임 필드 앵커링용
  const nicknameRef = useRef<HTMLDivElement>(null);

  // ── 진입 시: 기존 프로필 데이터 불러오기 ──────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, birthdate, gender, job_field, career_level, main_concern, profile_completed')
        .eq('id', user.id)
        .single();

      if (profile) {
        // 수정 모드: 기존 값 prefill
        const nick = profile.nickname ?? '';
        const bd   = profile.birthdate ?? '';
        const gen  = profile.gender ?? '';
        const job  = profile.job_field ?? '';
        const car  = profile.career_level ?? '';
        const con  = profile.main_concern ?? '';

        setNickname(nick);
        setBirthdate(bd);
        setGender(gen);
        setJobField(job);
        setCareerLevel(car);
        setMainConcern(con);

        originalValues.current = { nickname: nick, gender: gen, jobField: job, careerLevel: car, mainConcern: con };

        // 신규 진입인데 이미 완료된 경우 → 라우팅
        if (!isEditMode && profile.profile_completed) {
          router.push('/onboarding/strengths');
          return;
        }
      }

      // sessionStorage 임시 저장 복원 (새로고침 대비)
      // 1시간 이상 된 draft는 무시 (오래된 데이터가 최신 DB 값을 덮어쓰는 문제 방지)
      const draft = sessionStorage.getItem('draft_basic_info');
      if (draft && !isEditMode) {
        try {
          const parsed = JSON.parse(draft);
          const ONE_HOUR = 60 * 60 * 1000;
          const isRecentDraft = parsed.savedAt && (Date.now() - parsed.savedAt < ONE_HOUR);
          if (isRecentDraft) {
            if (parsed.nickname) setNickname(parsed.nickname);
            if (parsed.gender)   setGender(parsed.gender);
            if (parsed.jobField) setJobField(parsed.jobField);
            if (parsed.careerLevel) setCareerLevel(parsed.careerLevel);
            if (parsed.mainConcern) setMainConcern(parsed.mainConcern);
          } else {
            // 오래된 draft 삭제
            sessionStorage.removeItem('draft_basic_info');
          }
        } catch { /* 무시 */ }
      }

      setInitialLoading(false);
    };

    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 임시 저장 (1분마다) ────────────────────────────────────
  useEffect(() => {
    if (isEditMode || initialLoading) return;
    const timer = setInterval(() => {
      sessionStorage.setItem('draft_basic_info', JSON.stringify({
        nickname, gender, jobField, careerLevel, mainConcern,
        savedAt: Date.now(),
      }));
    }, 60_000);
    return () => clearInterval(timer);
  }, [nickname, gender, jobField, careerLevel, mainConcern, isEditMode, initialLoading]);

  // ── 버튼 활성화 조건 ───────────────────────────────────────
  const isChanged = isEditMode && (
    nickname !== originalValues.current.nickname ||
    gender   !== originalValues.current.gender   ||
    jobField !== originalValues.current.jobField  ||
    careerLevel !== originalValues.current.careerLevel ||
    mainConcern !== originalValues.current.mainConcern
  );
  const requiredFilled = nickname.trim() && jobField && careerLevel &&
    (!isEditMode ? !!birthdate : true);
  const btnEnabled = requiredFilled && (!isEditMode || isChanged);

  // ── 저장 처리 ─────────────────────────────────────────────
  const handleSubmit = async () => {
    // 클라이언트 검증
    let hasError = false;
    if (!nickname.trim()) { setNicknameError('닉네임을 입력해주세요'); hasError = true; }
    else if (nickname.trim().length > 10) { setNicknameError('닉네임은 10자 이하로 입력 가능합니다'); hasError = true; }
    if (!isEditMode && !birthdate) { setBirthdateError('생년월일을 입력해주세요'); hasError = true; }
    if (!jobField) { setJobError('직업/분야를 선택해주세요'); hasError = true; }
    if (!careerLevel) { setCareerError('경력을 선택해주세요'); hasError = true; }
    if (hasError) {
      // 닉네임 에러가 있으면 해당 필드로 스크롤
      if (!nickname.trim() || nickname.trim().length > 10) {
        nicknameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); router.push('/login'); return; }

    // 저장할 필드 구성
    const updates: Record<string, unknown> = {
      nickname: nickname.trim(),
      gender: gender || null,
      job_field: jobField,
      career_level: careerLevel,
      main_concern: mainConcern.trim() || null,
    };

    // 신규 진입: 생년월일 + profile_completed 포함
    if (!isEditMode) {
      updates.birthdate = birthdate;
      updates.profile_completed = true;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      alert('저장에 실패했어요. 다시 시도해주세요.');
      return;
    }

    // 임시 저장 삭제
    sessionStorage.removeItem('draft_basic_info');

    if (isEditMode) {
      // 수정 모드: 이전 화면으로 복귀
      router.back();
    } else {
      // 신규: 다음 단계로
      router.push('/onboarding/strengths');
    }
  };

  // ── 로딩 중 ───────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div style={wrapStyle}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>

      {/* ── 상단 바 ── */}
      <div style={topBarStyle}>
          {isEditMode ? (
            <button
              onClick={() => router.back()}
              style={backBtnStyle}
              aria-label="뒤로가기"
            >
              ←
            </button>
          ) : (
            <div style={{ width: '44px' }} />
          )}
          <span style={{ fontSize: '16px', fontWeight: 600, flex: 1, textAlign: 'center' }}>
            {isEditMode ? '기본 정보 수정' : '기본 정보'}
          </span>
          <div style={{ width: '44px' }} />
        </div>


        {/* ── 콘텐츠 ── */}
        <div style={{ padding: '24px 20px' }}>

        {/* 인트로 */}
        <div style={{ marginBottom: '24px' }}>
          {isEditMode && <div style={eyebrowStyle}>EDIT</div>}
          <div style={sectionTitleStyle}>
            {isEditMode
              ? '기본 정보를 업데이트해주세요'
              : <>반가워요! 👋<br />간단히 소개해주세요</>}
          </div>
          <div style={sectionDescStyle}>
            {isEditMode
              ? '변경 사항은 다음 AI 인터뷰부터 반영돼요'
              : '서비스 맞춤화를 위해 몇 가지 정보가 필요해요.'}
          </div>
        </div>

        {/* ── 닉네임 ── */}
        <div ref={nicknameRef}>
        <FormGroup label="닉네임" required error={nicknameError}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                const val = e.target.value;
                setNickname(val);
                if (val.trim().length > 10) {
                  setNicknameError('닉네임은 10자 이하로 입력 가능합니다');
                } else {
                  setNicknameError('');
                }
              }}
              placeholder="어떻게 불러드릴까요?"
              maxLength={10}
              aria-describedby={nicknameError ? 'nickname-error' : undefined}
              style={inputStyle}
            />
            <span style={{
              position: 'absolute', right: '12px', top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '12px', color: 'var(--text-muted)',
            }}>
              {nickname.length}/10
            </span>
          </div>
          {nicknameError && <ErrorMsg id="nickname-error">{nicknameError}</ErrorMsg>}
        </FormGroup>
        </div>

        {/* ── 생년월일 ── */}
        <FormGroup
          label="생년월일"
          required={!isEditMode}
          error={birthdateError}
          hint={isEditMode ? '생년월일은 수정할 수 없어요. 변경이 필요하면 고객센터로 문의해주세요.' : undefined}
        >
          <input
            type="date"
            value={birthdate}
            onChange={(e) => { setBirthdate(e.target.value); setBirthdateError(''); }}
            max={getMaxBirthdate()}
            disabled={isEditMode}
            aria-readonly={isEditMode}
            aria-describedby={birthdateError ? 'birthdate-error' : undefined}
            style={{
              ...inputStyle,
              opacity: isEditMode ? 0.5 : 1,
              cursor: isEditMode ? 'not-allowed' : 'auto',
              background: isEditMode ? 'var(--bg)' : 'var(--surface)',
            }}
          />
          {birthdateError && <ErrorMsg id="birthdate-error">{birthdateError}</ErrorMsg>}
        </FormGroup>

        {/* ── 성별 ── */}
        <FormGroup label="성별">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(gender === opt.value ? '' : opt.value)}
                style={{
                  flex: 1, minWidth: '70px', padding: '10px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: gender === opt.value
                    ? '1.5px solid var(--accent)'
                    : '1.5px solid var(--border)',
                  background: gender === opt.value ? 'var(--accent-light)' : 'var(--surface)',
                  color: gender === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormGroup>

        {/* ── 직업/분야 ── */}
        <FormGroup label="현재 직업/분야" required error={jobError}>
          <select
            value={jobField}
            onChange={(e) => { setJobField(e.target.value); setJobError(''); }}
            aria-describedby={jobError ? 'job-error' : undefined}
            style={selectStyle}
          >
            <option value="" disabled>선택해주세요</option>
            {JOB_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {jobError && <ErrorMsg id="job-error">{jobError}</ErrorMsg>}
        </FormGroup>

        {/* ── 경력 ── */}
        <FormGroup label="경력" required error={careerError}>
          <select
            value={careerLevel}
            onChange={(e) => { setCareerLevel(e.target.value); setCareerError(''); }}
            aria-describedby={careerError ? 'career-error' : undefined}
            style={selectStyle}
          >
            <option value="" disabled>선택해주세요</option>
            {CAREER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {careerError && <ErrorMsg id="career-error">{careerError}</ErrorMsg>}
        </FormGroup>

        {/* ── 커리어 고민 ── */}
        <FormGroup label="지금 가장 큰 커리어 고민은?">
          <div style={{ position: 'relative' }}>
            <textarea
              value={mainConcern}
              onChange={(e) => setMainConcern(e.target.value)}
              placeholder="예) 이직을 해야 하는지 모르겠어요."
              maxLength={200}
              rows={3}
              style={{ ...inputStyle, resize: 'none', paddingBottom: '28px' }}
            />
            <span style={{
              position: 'absolute', right: '12px', bottom: '10px',
              fontSize: '12px', color: 'var(--text-muted)',
            }}>
              {mainConcern.length}/200
            </span>
          </div>
        </FormGroup>

        <div style={{ height: '8px' }} />
      </div>

      {/* ── 하단 CTA ── */}
      <div style={bottomBarStyle}>
        {isEditMode && (
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: '100%', padding: '14px', marginBottom: '10px',
              background: 'none', border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)', fontSize: '15px', fontWeight: 600,
              fontFamily: 'inherit', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            취소
          </button>
        )}
        <button
          type="button"
          disabled={!btnEnabled || loading}
          onClick={handleSubmit}
          style={{
            width: '100%', padding: '16px', background: 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
            cursor: btnEnabled && !loading ? 'pointer' : 'not-allowed',
            opacity: btnEnabled && !loading ? 1 : 0.4,
            boxShadow: '0 4px 16px rgba(45,91,255,.3)',
          }}
        >
          {loading ? '저장 중...' : isEditMode ? '저장' : '다음으로 →'}
        </button>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────
function FormGroup({
  label, required = false, error, hint, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>}
        {!required && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(선택)</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function ErrorMsg({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} role="alert" style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '2px' }}>
      {children}
    </div>
  );
}

// ── 스타일 상수 ────────────────────────────────────────────────
const wrapStyle: React.CSSProperties = {
  width: 'min(430px, 100vw)', minHeight: '100dvh', background: 'var(--surface)',
  display: 'flex', flexDirection: 'column', margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
};

const topBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '10px 16px', gap: '12px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
};

const backBtnStyle: React.CSSProperties = {
  width: '44px', height: '44px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', border: 'none', background: 'none',
  cursor: 'pointer', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontSize: '20px',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
  letterSpacing: '.08em', marginBottom: '8px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)',
  lineHeight: 1.35, letterSpacing: '-.5px', marginBottom: '10px',
};

const sectionDescStyle: React.CSSProperties = {
  fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
  fontSize: '16px', lineHeight: '1.5', // date input 높이를 text input과 동일하게 맞춤
  fontFamily: 'inherit', color: 'var(--text-primary)',
  background: 'var(--surface)', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '36px',
  cursor: 'pointer',
};

const bottomBarStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  padding: '16px 20px',
  paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  background: 'var(--surface)', borderTop: '1px solid var(--border)',
  zIndex: 20,
};
