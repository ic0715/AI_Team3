// 로그인/회원가입 폼에서 쓰는 순수 검증 함수.
// 외부 의존성 없음 → 단위 테스트 용이. UI에서 분리해 재사용 가능하게 보관.

export interface PasswordStrength {
  level: 0 | 1 | 2 | 3;
  label: string;
  color: string;
}

/**
 * 비밀번호 강도 계산.
 * - 빈 문자열 → level 0
 * - 8자 미만 → level 1 (약함)
 * - 영문+숫자 + 12자 이상 → level 3 (강함)
 * - 영문+숫자 (8~11자) → level 2 (보통)
 * - 그 외 (영문만 또는 숫자만, 8자 이상) → level 1 (약함)
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (password.length < 8) return { level: 1, label: '약함', color: '#EF4444' };
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasLetter && hasNumber && password.length >= 12) return { level: 3, label: '강함', color: '#10B981' };
  if (hasLetter && hasNumber) return { level: 2, label: '보통', color: '#F59E0B' };
  return { level: 1, label: '약함', color: '#EF4444' };
}

/**
 * 만 14세 이상 검증 (한국 만 나이 계산).
 * - 빈 문자열 → false
 * - 생일이 오늘 기준 14년 전 이전이면 true
 */
export function isOver14(birthdate: string): boolean {
  if (!birthdate) return false;
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) return age - 1 >= 14;
  return age >= 14;
}
