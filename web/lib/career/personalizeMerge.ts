/**
 * 09 커리어 방향 결과 — Step2 AI 개인화 응답 검증/머지 (순수 로직).
 *
 * career-personalize API(route.ts)는 Claude가 돌려준 JSON 배열
 * ([{slot, personalizedText}, ...])을 결정적 매칭 결과(matchedSlots, 5장)에
 * 머지해 personalizedText를 채운다. 이 검증/머지 로직만 따로 떼어 단위 테스트한다.
 *
 * 두 가지 방어 지점:
 *  1. `validatePersonalizedResponse` — LLM이 정확히 5개 배열을 반환하지 않으면 던진다.
 *     (배열 아님 / 길이 != 5). route.ts의 기존 가드와 동일한 메시지/조건.
 *  2. `mergePersonalizedSlots` — matchedSlots 순서를 기준으로 slot 번호를 매칭해
 *     personalizedText를 붙인다. parsed에 해당 slot이 없으면 던진다.
 *
 * 이전엔 app/api/career-personalize/route.ts 인라인 로직. 동작 보존(verbatim) 추출.
 */

export interface ParsedPersonalizedSlot {
  slot: number;
  personalizedText: string;
}

/**
 * LLM이 반환한 파싱 결과가 정확히 5개짜리 배열인지 검증.
 * 아니면 route.ts 기존과 동일한 메시지로 throw.
 *
 * 입력이 unknown인 이유: parseJSONLoose가 무엇이든 돌려줄 수 있어
 * (배열 아님/null/객체) 런타임에서 좁혀야 한다.
 */
export function validatePersonalizedResponse(
  parsed: unknown,
): asserts parsed is ParsedPersonalizedSlot[] {
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new Error(
      `LLM이 5개 슬롯을 반환하지 않음: ${(parsed as { length?: number })?.length ?? 0}개`,
    );
  }
}

/**
 * matchedSlots(결정적 매칭 5장)에 parsed의 personalizedText를 머지.
 * - matchedSlots 순서/개수를 그대로 보존(결과 배열 = 입력 매칭 순서).
 * - 각 슬롯 번호(slot)로 parsed에서 대응 항목을 찾아 personalizedText만 덧붙임.
 * - 대응 항목이 없으면 `슬롯 N 결과 누락` throw.
 *
 * 제네릭 M은 최소 { slot: number }만 요구 → route.ts의 풍부한 슬롯 타입을 그대로 통과.
 */
export function mergePersonalizedSlots<M extends { slot: number }>(
  matchedSlots: M[],
  parsed: ParsedPersonalizedSlot[],
): Array<M & { personalizedText: string }> {
  return matchedSlots.map((m) => {
    const found = parsed.find((p) => p.slot === m.slot);
    if (!found) throw new Error(`슬롯 ${m.slot} 결과 누락`);
    return { ...m, personalizedText: found.personalizedText };
  });
}
