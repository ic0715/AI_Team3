/**
 * NEW07 비밀번호 변경(app/profile/password-change/page.tsx) — 비밀번호 강도 순수 로직.
 *
 * 페이지에 인라인돼 있던 강도 평가/라벨/색상을 단위 테스트 가능하도록 분리.
 * 로직은 원본 그대로(verbatim) 옮긴 뒤 페이지에서 import해 사용한다.
 *
 * 경계값 주의:
 * - 8자 미만 → 'weak'
 * - 12자 이상 + 영문+숫자+특수문자 → 'strong'
 * - 영문+숫자 → 'medium', 그 외 → 'weak'
 */

export type StrengthLevel = 'weak' | 'medium' | 'strong';

export function evaluateStrength(pwd: string): StrengthLevel {
  if (pwd.length < 8) return 'weak';
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
  if (pwd.length >= 12 && hasLetter && hasNumber && hasSpecial) return 'strong';
  if (hasLetter && hasNumber) return 'medium';
  return 'weak';
}

export const STRENGTH_LABEL: Record<StrengthLevel, string> = {
  weak: '약함',
  medium: '보통',
  strong: '강함',
};

export const STRENGTH_COLOR: Record<StrengthLevel, string> = {
  weak: '#dc2626',
  medium: '#F59E0B',
  strong: '#10B981',
};
