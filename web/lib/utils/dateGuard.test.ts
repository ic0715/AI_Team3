import { describe, expect, it } from 'vitest';
import { canToggleDate } from './dateGuard';

describe('canToggleDate', () => {
  // 기준 시각: 2026-06-01 정오 (시·분·초 있는 시각도 정상 처리 확인)
  const now = new Date('2026-06-01T12:00:00');

  it('오늘 (같은 날짜)은 허용 — 시각 다르더라도 OK', () => {
    expect(canToggleDate(new Date('2026-06-01T00:00:00'), now)).toBe(true);
    expect(canToggleDate(new Date('2026-06-01T23:59:59'), now)).toBe(true);
  });

  it('어제는 허용', () => {
    expect(canToggleDate(new Date('2026-05-31T12:00:00'), now)).toBe(true);
  });

  it('한참 과거도 허용 (3개월 전)', () => {
    expect(canToggleDate(new Date('2026-03-01T00:00:00'), now)).toBe(true);
  });

  it('내일은 차단', () => {
    expect(canToggleDate(new Date('2026-06-02T00:00:00'), now)).toBe(false);
  });

  it('내일 새벽 0시 1분도 차단', () => {
    expect(canToggleDate(new Date('2026-06-02T00:00:01'), now)).toBe(false);
  });

  it('일주일 후도 차단', () => {
    expect(canToggleDate(new Date('2026-06-08T12:00:00'), now)).toBe(false);
  });

  it('Invalid Date는 차단 (방어적)', () => {
    expect(canToggleDate(new Date('not-a-date'), now)).toBe(false);
  });

  it('Date가 아닌 입력도 차단', () => {
    // 타입 안전성 우회 — 런타임 방어가 작동하는지
    expect(canToggleDate('2026-06-01' as unknown as Date, now)).toBe(false);
    expect(canToggleDate(null as unknown as Date, now)).toBe(false);
    expect(canToggleDate(undefined as unknown as Date, now)).toBe(false);
  });

  it('now 인자가 invalid면 차단', () => {
    expect(canToggleDate(new Date('2026-06-01'), new Date('invalid'))).toBe(false);
  });

  it('today 자정 boundary — 오늘 자정과 동일하면 허용', () => {
    const todayMidnight = new Date('2026-06-01T00:00:00');
    expect(canToggleDate(todayMidnight, now)).toBe(true);
  });

  it('어제 23:59:59는 허용 (어제 날짜)', () => {
    expect(canToggleDate(new Date('2026-05-31T23:59:59'), now)).toBe(true);
  });

  it('기본 인자 (now 미주입) — 호출 시점 기준 동작', () => {
    // 실제 호출 시 now=new Date() 사용. 과거 날짜는 항상 허용.
    expect(canToggleDate(new Date('2020-01-01'))).toBe(true);
  });

  it('월말 경계 (5/31 → 6/1)', () => {
    const may31Noon = new Date('2026-05-31T12:00:00');
    expect(canToggleDate(new Date('2026-05-31T23:00:00'), may31Noon)).toBe(true);
    expect(canToggleDate(new Date('2026-06-01T00:00:00'), may31Noon)).toBe(false);
  });
});
