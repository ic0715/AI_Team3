import { describe, expect, it } from 'vitest';
import { buildFutureActionsByWeek, type FutureActionRow } from './futureActions';

describe('buildFutureActionsByWeek', () => {
  it('null이면 빈 Map 반환', () => {
    expect(buildFutureActionsByWeek(null).size).toBe(0);
  });

  it('undefined도 빈 Map 반환', () => {
    expect(buildFutureActionsByWeek(undefined).size).toBe(0);
  });

  it('빈 배열도 빈 Map 반환', () => {
    expect(buildFutureActionsByWeek([]).size).toBe(0);
  });

  it('단일 행은 그대로 매핑', () => {
    const rows: FutureActionRow[] = [{ week_number: 3, title: '주제 합의' }];
    const map = buildFutureActionsByWeek(rows);
    expect(map.size).toBe(1);
    expect(map.get(3)).toBe('주제 합의');
  });

  it('서로 다른 주차는 모두 보존', () => {
    const rows: FutureActionRow[] = [
      { week_number: 3, title: 'A' },
      { week_number: 4, title: 'B' },
      { week_number: 5, title: 'C' },
    ];
    const map = buildFutureActionsByWeek(rows);
    expect(map.size).toBe(3);
    expect(map.get(3)).toBe('A');
    expect(map.get(4)).toBe('B');
    expect(map.get(5)).toBe('C');
  });

  it('같은 주차 중복 시 첫 발견 우선 (호출 측이 created_at DESC로 정렬했다는 전제)', () => {
    // 호출 측이 ORDER BY week_number ASC, created_at DESC로 정렬했으므로
    // 같은 주차의 첫 항목이 최신 created_at임. 이게 유지돼야 함.
    const rows: FutureActionRow[] = [
      { week_number: 3, title: '최신 (W3)' },
      { week_number: 3, title: '과거 (W3)' }, // 무시돼야 함
      { week_number: 4, title: 'W4 액션' },
    ];
    const map = buildFutureActionsByWeek(rows);
    expect(map.size).toBe(2);
    expect(map.get(3)).toBe('최신 (W3)');
    expect(map.get(4)).toBe('W4 액션');
  });

  it('같은 주차 3개 중복도 첫 번째만', () => {
    const rows: FutureActionRow[] = [
      { week_number: 5, title: '첫번째 (= 최신)' },
      { week_number: 5, title: '두번째' },
      { week_number: 5, title: '세번째' },
    ];
    const map = buildFutureActionsByWeek(rows);
    expect(map.size).toBe(1);
    expect(map.get(5)).toBe('첫번째 (= 최신)');
  });

  it('순서가 섞여도 각 주차 첫 발견 유지', () => {
    // ⚠️ 이 케이스는 호출 측 ORDER BY가 깨졌을 때를 시뮬레이션.
    // 본 함수는 입력 순서를 신뢰하므로 잘못된 액션이 노출됨.
    // → 회귀 방어용 테스트: 만약 미래에 정렬 정책이 바뀌면 이 테스트가 가이드.
    const rows: FutureActionRow[] = [
      { week_number: 4, title: '4주차-첫' },
      { week_number: 3, title: '3주차-첫' },
      { week_number: 4, title: '4주차-둘' },
      { week_number: 3, title: '3주차-둘' },
    ];
    const map = buildFutureActionsByWeek(rows);
    expect(map.get(3)).toBe('3주차-첫');
    expect(map.get(4)).toBe('4주차-첫');
  });

  it('미래 주차 범위(8주차 등) 정상 매핑', () => {
    const rows: FutureActionRow[] = [
      { week_number: 8, title: '한참 미래' },
      { week_number: 12, title: '마지막 주차' },
    ];
    const map = buildFutureActionsByWeek(rows);
    expect(map.get(8)).toBe('한참 미래');
    expect(map.get(12)).toBe('마지막 주차');
  });

  it('빈 제목 문자열도 보존 (정책: 빈 값 필터링 없음)', () => {
    const rows: FutureActionRow[] = [{ week_number: 4, title: '' }];
    const map = buildFutureActionsByWeek(rows);
    expect(map.size).toBe(1);
    expect(map.get(4)).toBe('');
  });
});
