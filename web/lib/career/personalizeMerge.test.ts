import { describe, expect, it } from 'vitest';
import {
  validatePersonalizedResponse,
  mergePersonalizedSlots,
  type ParsedPersonalizedSlot,
} from './personalizeMerge';

// 5장짜리 정상 파싱 결과
function five(): ParsedPersonalizedSlot[] {
  return [1, 2, 3, 4, 5].map((slot) => ({ slot, personalizedText: `텍스트${slot}` }));
}

// 결정적 매칭 슬롯(최소 형태 + route.ts 처럼 추가 필드)
function matched(...slots: number[]) {
  return slots.map((slot) => ({
    slot,
    competencyId: `c-${slot}`,
    goalTitle: `목표${slot}`,
    badge: 'user_interest',
  }));
}

// 3장짜리 정상 파싱 결과 (현재 COMPETENCY_DISPLAY_COUNT)
function three(): ParsedPersonalizedSlot[] {
  return [1, 2, 3].map((slot) => ({ slot, personalizedText: `텍스트${slot}` }));
}

describe('validatePersonalizedResponse', () => {
  it('기대 개수(3)와 일치하면 통과 (throw 없음)', () => {
    expect(() => validatePersonalizedResponse(three(), 3)).not.toThrow();
  });

  it('기대 개수(5)와 일치하면 통과 (레거시 길이도 인자로 검증)', () => {
    expect(() => validatePersonalizedResponse(five(), 5)).not.toThrow();
  });

  it('배열이 아니면 throw — null (기대 개수 메시지에 노출)', () => {
    expect(() => validatePersonalizedResponse(null, 3)).toThrow('LLM이 3개 슬롯을 반환하지 않음: 0개');
  });

  it('배열이 아니면 throw — 객체', () => {
    expect(() => validatePersonalizedResponse({ slot: 1 }, 3)).toThrow(
      'LLM이 3개 슬롯을 반환하지 않음: 0개',
    );
  });

  it('배열이 아니면 throw — undefined', () => {
    expect(() => validatePersonalizedResponse(undefined, 3)).toThrow(
      'LLM이 3개 슬롯을 반환하지 않음: 0개',
    );
  });

  it('기대 개수보다 적으면 throw — 기대 3, 실제 2 (개수 메시지에 노출)', () => {
    expect(() => validatePersonalizedResponse(three().slice(0, 2), 3)).toThrow(
      'LLM이 3개 슬롯을 반환하지 않음: 2개',
    );
  });

  it('기대 개수보다 많으면 throw — 기대 3, 실제 5', () => {
    expect(() => validatePersonalizedResponse(five(), 3)).toThrow(
      'LLM이 3개 슬롯을 반환하지 않음: 5개',
    );
  });

  it('빈 배열 → throw (0개)', () => {
    expect(() => validatePersonalizedResponse([], 3)).toThrow(
      'LLM이 3개 슬롯을 반환하지 않음: 0개',
    );
  });

  it('통과 후 타입 가드로 좁혀짐(asserts) — 컴파일+런타임', () => {
    const parsed: unknown = three();
    validatePersonalizedResponse(parsed, 3);
    // 좁혀진 뒤 인덱싱 가능
    expect(parsed[0].slot).toBe(1);
  });
});

describe('mergePersonalizedSlots', () => {
  it('매칭 순서를 보존하며 personalizedText를 붙인다', () => {
    const result = mergePersonalizedSlots(matched(1, 2, 3, 4, 5), five());
    expect(result.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(result.map((s) => s.personalizedText)).toEqual([
      '텍스트1', '텍스트2', '텍스트3', '텍스트4', '텍스트5',
    ]);
  });

  it('원본 슬롯의 다른 필드(competencyId 등)를 보존한다', () => {
    const result = mergePersonalizedSlots(matched(1, 2, 3, 4, 5), five());
    expect(result[0].competencyId).toBe('c-1');
    expect(result[0].goalTitle).toBe('목표1');
    expect(result[0].badge).toBe('user_interest');
  });

  it('parsed의 순서가 뒤섞여 있어도 slot 번호로 정확히 매칭', () => {
    const shuffled: ParsedPersonalizedSlot[] = [
      { slot: 3, personalizedText: 'C' },
      { slot: 1, personalizedText: 'A' },
      { slot: 5, personalizedText: 'E' },
      { slot: 2, personalizedText: 'B' },
      { slot: 4, personalizedText: 'D' },
    ];
    const result = mergePersonalizedSlots(matched(1, 2, 3, 4, 5), shuffled);
    expect(result.map((s) => s.personalizedText)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('매칭 슬롯에 대응하는 parsed 항목이 없으면 throw (슬롯 N 결과 누락)', () => {
    // parsed에 slot=3이 빠지고 slot=9가 대신 들어옴
    const broken: ParsedPersonalizedSlot[] = [
      { slot: 1, personalizedText: 'A' },
      { slot: 2, personalizedText: 'B' },
      { slot: 9, personalizedText: 'X' },
      { slot: 4, personalizedText: 'D' },
      { slot: 5, personalizedText: 'E' },
    ];
    expect(() => mergePersonalizedSlots(matched(1, 2, 3, 4, 5), broken)).toThrow(
      '슬롯 3 결과 누락',
    );
  });

  it('slot 번호가 1~5가 아니어도(임의 번호) 매칭 동작', () => {
    const matchedSlots = matched(7, 8);
    const parsed: ParsedPersonalizedSlot[] = [
      { slot: 8, personalizedText: 'eight' },
      { slot: 7, personalizedText: 'seven' },
    ];
    const result = mergePersonalizedSlots(matchedSlots, parsed);
    expect(result.map((s) => [s.slot, s.personalizedText])).toEqual([
      [7, 'seven'],
      [8, 'eight'],
    ]);
  });

  it('중복 slot 번호가 parsed에 있으면 첫 번째 항목을 사용 (find 의미 보존)', () => {
    const parsed: ParsedPersonalizedSlot[] = [
      { slot: 1, personalizedText: 'first' },
      { slot: 1, personalizedText: 'second' },
    ];
    const result = mergePersonalizedSlots(matched(1), parsed);
    expect(result[0].personalizedText).toBe('first');
  });

  it('빈 매칭 배열 → 빈 결과 (parsed 무관)', () => {
    expect(mergePersonalizedSlots([], five())).toEqual([]);
  });
});
