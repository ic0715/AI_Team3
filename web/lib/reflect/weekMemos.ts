/**
 * 회고 화면(app/reflect/page.tsx) — 순수 로직 추출.
 *
 * 페이지에 인라인돼 있던 주(week) 범위 계산 / 데일리 메모 정렬·삽입 /
 * 메모 시각 포맷 로직을 단위 테스트 가능하도록 분리.
 *
 * 변경점:
 * - 기존 인라인 formatLocalISO는 lib/utils/localDate의 localISODate와 동일 →
 *   중복 제거(공통 함수 재사용).
 * - formatMemoTime: created_at이 유효하지 않은 경우 기존 코드는 'NaN:NaN'을
 *   렌더했음 → 무효 입력은 빈 문자열로 방어(하드닝).
 */

import { localISODate } from '@/lib/utils/localDate';

/** 일~토 한글 요일 라벨(getDay() 인덱스). */
export const WEEKDAY_KO_FULL = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 데일리 메모 — schema v0.8 다중 누적 정책. */
export interface DailyMemo {
  id?: string;
  memo_date: string; // YYYY-MM-DD
  content: string;
  created_at?: string; // 시간 정렬용 ISO
}

/**
 * 주어진 날짜가 속한 주의 월요일 00:00(로컬).
 * 일요일(getDay()===0)은 직전 월요일로(-6), 그 외는 (1 - day)만큼 이동.
 * 원본 Date는 변형하지 않음.
 */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** n일 더한 새 Date(원본 불변). 음수/0/월·연 경계 모두 Date 산술에 위임. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * today가 속한 주(월~일)의 로컬 ISO 범위.
 * daily_memos 주간 조회(gte mondayISO / lte sundayISO)에 사용.
 */
export function weekRangeISO(today: Date): { mondayISO: string; sundayISO: string } {
  const monday = startOfWeekMonday(today);
  return {
    mondayISO: localISODate(monday),
    sundayISO: localISODate(addDays(monday, 6)),
  };
}

/**
 * 메모 정렬 비교자: memo_date 오름차순, 동일 날짜는 created_at 오름차순.
 * created_at 누락 시 빈 문자열로 취급(맨 앞).
 */
export function compareMemos(a: DailyMemo, b: DailyMemo): number {
  const dateDiff = a.memo_date.localeCompare(b.memo_date);
  if (dateDiff !== 0) return dateDiff;
  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

/**
 * 새 메모를 추가하고 정렬된 새 배열을 반환(원본 불변).
 * 저장 직후 낙관적 append + 시간순 정렬에 사용.
 */
export function insertMemoSorted(memos: DailyMemo[], memo: DailyMemo): DailyMemo[] {
  return [...memos, memo].sort(compareMemos);
}

/**
 * created_at(ISO) → 'HH:MM'(로컬). 없거나 무효한 값이면 빈 문자열.
 * (기존 코드는 무효 입력 시 'NaN:NaN'을 렌더했음 → 방어)
 */
export function formatMemoTime(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 날짜의 한글 요일 한 글자(로컬 getDay 기준). */
export function weekdayKo(date: Date): string {
  return WEEKDAY_KO_FULL[date.getDay()];
}
