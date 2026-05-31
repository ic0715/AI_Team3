import { describe, expect, it } from 'vitest';
import { localISODate } from '@/lib/utils/localDate';
import {
  addDays,
  compareMemos,
  type DailyMemo,
  formatMemoTime,
  insertMemoSorted,
  startOfWeekMonday,
  weekdayKo,
  weekRangeISO,
  WEEKDAY_KO_FULL,
} from './weekMemos';

// 로컬 생성자 → TZ 무관 결정적. 2026-06-01은 월요일.
const memo = (over: Partial<DailyMemo> = {}): DailyMemo => ({
  memo_date: '2026-06-01',
  content: '메모',
  created_at: '2026-06-01T09:00:00',
  ...over,
});

// ─────────────────────────────────────────────────────────────
// startOfWeekMonday
// ─────────────────────────────────────────────────────────────
describe('startOfWeekMonday', () => {
  it('월요일 → 그대로(자기 자신)', () => {
    expect(localISODate(startOfWeekMonday(new Date(2026, 5, 1)))).toBe('2026-06-01');
  });

  it('주중(목요일) → 같은 주 월요일', () => {
    // 2026-06-04 (목) → 2026-06-01 (월)
    expect(localISODate(startOfWeekMonday(new Date(2026, 5, 4)))).toBe('2026-06-01');
  });

  it('일요일 → 직전 월요일(-6, 엣지)', () => {
    // 2026-06-07 (일) → 2026-06-01 (월)
    expect(localISODate(startOfWeekMonday(new Date(2026, 5, 7)))).toBe('2026-06-01');
  });

  it('월 경계를 넘어가는 주도 정상', () => {
    // 2026-06-30 (화) → 2026-06-29 (월)
    expect(localISODate(startOfWeekMonday(new Date(2026, 5, 30)))).toBe('2026-06-29');
  });

  it('시각을 00:00으로 리셋', () => {
    const d = startOfWeekMonday(new Date(2026, 5, 4, 15, 30, 45));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('원본 Date 불변', () => {
    const orig = new Date(2026, 5, 4, 15, 30);
    const snapshot = orig.getTime();
    startOfWeekMonday(orig);
    expect(orig.getTime()).toBe(snapshot);
  });
});

// ─────────────────────────────────────────────────────────────
// addDays
// ─────────────────────────────────────────────────────────────
describe('addDays', () => {
  it('양수 — 월 경계 넘김', () => {
    expect(localISODate(addDays(new Date(2026, 5, 29), 6))).toBe('2026-07-05');
  });

  it('음수', () => {
    expect(localISODate(addDays(new Date(2026, 5, 1), -1))).toBe('2026-05-31');
  });

  it('0 → 같은 날', () => {
    expect(localISODate(addDays(new Date(2026, 5, 1), 0))).toBe('2026-06-01');
  });

  it('원본 불변', () => {
    const orig = new Date(2026, 5, 1);
    addDays(orig, 10);
    expect(localISODate(orig)).toBe('2026-06-01');
  });
});

// ─────────────────────────────────────────────────────────────
// weekRangeISO
// ─────────────────────────────────────────────────────────────
describe('weekRangeISO', () => {
  it('월~일 범위(월요일 기준 +6)', () => {
    expect(weekRangeISO(new Date(2026, 5, 4))).toEqual({
      mondayISO: '2026-06-01',
      sundayISO: '2026-06-07',
    });
  });

  it('일요일도 같은 주로 묶임', () => {
    expect(weekRangeISO(new Date(2026, 5, 7))).toEqual({
      mondayISO: '2026-06-01',
      sundayISO: '2026-06-07',
    });
  });

  it('월 경계를 가로지르는 주', () => {
    // 2026-06-30 (화) 주 → 월 2026-06-29 ~ 일 2026-07-05
    expect(weekRangeISO(new Date(2026, 5, 30))).toEqual({
      mondayISO: '2026-06-29',
      sundayISO: '2026-07-05',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// compareMemos
// ─────────────────────────────────────────────────────────────
describe('compareMemos', () => {
  it('날짜가 다르면 memo_date 오름차순', () => {
    expect(compareMemos(memo({ memo_date: '2026-06-01' }), memo({ memo_date: '2026-06-02' }))).toBeLessThan(0);
    expect(compareMemos(memo({ memo_date: '2026-06-03' }), memo({ memo_date: '2026-06-02' }))).toBeGreaterThan(0);
  });

  it('같은 날짜는 created_at 오름차순', () => {
    const a = memo({ created_at: '2026-06-01T09:00:00' });
    const b = memo({ created_at: '2026-06-01T10:00:00' });
    expect(compareMemos(a, b)).toBeLessThan(0);
  });

  it('created_at 누락 → 빈 문자열(맨 앞)', () => {
    const noTime = memo({ created_at: undefined });
    const withTime = memo({ created_at: '2026-06-01T10:00:00' });
    expect(compareMemos(noTime, withTime)).toBeLessThan(0);
  });

  it('둘 다 created_at 누락 → 0(동률)', () => {
    expect(compareMemos(memo({ created_at: undefined }), memo({ created_at: undefined }))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// insertMemoSorted
// ─────────────────────────────────────────────────────────────
describe('insertMemoSorted', () => {
  it('추가 후 시간순 정렬', () => {
    const existing = [memo({ memo_date: '2026-06-02', content: 'B' })];
    const next = insertMemoSorted(existing, memo({ memo_date: '2026-06-01', content: 'A' }));
    expect(next.map((m) => m.content)).toEqual(['A', 'B']);
  });

  it('같은 날짜는 created_at 순서로 끼워넣음', () => {
    const existing = [
      memo({ memo_date: '2026-06-01', content: '아침', created_at: '2026-06-01T08:00:00' }),
      memo({ memo_date: '2026-06-01', content: '저녁', created_at: '2026-06-01T20:00:00' }),
    ];
    const next = insertMemoSorted(existing, memo({ memo_date: '2026-06-01', content: '점심', created_at: '2026-06-01T12:00:00' }));
    expect(next.map((m) => m.content)).toEqual(['아침', '점심', '저녁']);
  });

  it('원본 배열 불변(새 배열 반환)', () => {
    const existing = [memo({ content: 'A' })];
    const next = insertMemoSorted(existing, memo({ content: 'B' }));
    expect(existing).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next).not.toBe(existing);
  });
});

// ─────────────────────────────────────────────────────────────
// formatMemoTime — 무효 입력 하드닝
// ─────────────────────────────────────────────────────────────
describe('formatMemoTime', () => {
  it('유효 ISO(로컬 시각) → HH:MM', () => {
    // 타임존 designator 없음 → 로컬 시각으로 파싱(결정적)
    expect(formatMemoTime('2026-06-01T09:05:00')).toBe('09:05');
  });

  it('시/분 zero-padding', () => {
    expect(formatMemoTime('2026-06-01T03:07:00')).toBe('03:07');
    expect(formatMemoTime('2026-06-01T23:59:00')).toBe('23:59');
  });

  it('null/undefined/빈 문자열 → 빈 문자열', () => {
    expect(formatMemoTime(null)).toBe('');
    expect(formatMemoTime(undefined)).toBe('');
    expect(formatMemoTime('')).toBe('');
  });

  it('무효 날짜 문자열 → 빈 문자열(기존 NaN:NaN 방어)', () => {
    expect(formatMemoTime('not-a-date')).toBe('');
    expect(formatMemoTime('2026-13-99T99:99:99')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// weekdayKo
// ─────────────────────────────────────────────────────────────
describe('weekdayKo', () => {
  it('월요일 → 월, 일요일 → 일', () => {
    expect(weekdayKo(new Date(2026, 5, 1))).toBe('월');
    expect(weekdayKo(new Date(2026, 5, 7))).toBe('일');
  });

  it('WEEKDAY_KO_FULL 인덱스와 일치', () => {
    const d = new Date(2026, 5, 4); // 목
    expect(weekdayKo(d)).toBe(WEEKDAY_KO_FULL[d.getDay()]);
    expect(weekdayKo(d)).toBe('목');
  });
});
