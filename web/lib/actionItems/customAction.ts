/**
 * 10 액션 아이템 — "나만의 액션" 커스텀 입력 검증 (스펙 3.5).
 *
 * 정책:
 * - 앞뒤 공백 trim 후 길이 기준으로 판정.
 * - 5자 미만: "5자 이상 입력해주세요." (추가 불가)
 * - 50자 초과: "50자 이하로 입력해주세요." (방어적 — input maxLength로도 차단되지만 paste 등 우회 대비)
 * - 5~50자: 통과, trim된 값을 반환.
 * - null/undefined/빈 문자열/공백만: 5자 미만으로 처리(추가 불가).
 *
 * 길이는 JS `String.length`(UTF-16 code unit) 기준 — 한글 음절은 1, 이모지(surrogate pair)는 2.
 * 기존 page.tsx 동작을 그대로 보존하기 위해 의도적으로 code-unit 길이를 사용한다.
 *
 * 이전엔 app/onboarding/action-items/page.tsx의 handleAddCustom 내부 로직.
 * 단위 테스트 가능하도록 분리.
 */

export const CUSTOM_MIN = 5;
export const CUSTOM_MAX = 50;

export type CustomActionValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * 커스텀 액션 텍스트 검증. trim 후 길이 경계를 확인한다.
 * 성공 시 trim된 값을, 실패 시 사용자에게 보여줄 에러 메시지를 반환.
 */
export function validateCustomAction(
  text: string | null | undefined,
): CustomActionValidation {
  const trimmed = (text ?? '').trim();
  if (trimmed.length < CUSTOM_MIN) {
    return { ok: false, error: `${CUSTOM_MIN}자 이상 입력해주세요.` };
  }
  if (trimmed.length > CUSTOM_MAX) {
    return { ok: false, error: `${CUSTOM_MAX}자 이하로 입력해주세요.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * [추가] 버튼 활성화 판정 — trim 후 최소 길이만 확인.
 * (MAX는 input maxLength로 차단되므로 버튼 활성화 조건은 MIN만 본다.
 *  기존 page.tsx의 `customText.trim().length >= CUSTOM_MIN` 동작과 동일.)
 */
export function isCustomActionReady(text: string | null | undefined): boolean {
  return (text ?? '').trim().length >= CUSTOM_MIN;
}
