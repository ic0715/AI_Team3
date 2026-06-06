import { describe, expect, it } from 'vitest';
import { isReadyForResult, RESULT_READY_MIN_TURNS } from './resultReadiness';

// ─────────────────────────────────────────────────────────────
// isReadyForResult — 인터뷰 종료 버튼 분기의 단일 게이트 (commit 850e12f)
//   true  → 결과 생성 확인 다이얼로그
//   false → '결과 불가' 홈 안내
// ─────────────────────────────────────────────────────────────
describe('isReadyForResult', () => {
  it('phase=closing 이면 턴 수와 무관하게 항상 준비됨', () => {
    expect(isReadyForResult('closing', 0)).toBe(true);
    expect(isReadyForResult('closing', 1)).toBe(true);
    expect(isReadyForResult('closing', 100)).toBe(true);
  });

  it('phase=exploration 이면 N턴(=6) 이상에서만 준비됨', () => {
    expect(isReadyForResult('exploration', RESULT_READY_MIN_TURNS)).toBe(true);
    expect(isReadyForResult('exploration', RESULT_READY_MIN_TURNS + 1)).toBe(true);
  });

  it('phase=exploration 인데 N턴 미만이면 준비 안 됨 (얕은 탐색)', () => {
    expect(isReadyForResult('exploration', RESULT_READY_MIN_TURNS - 1)).toBe(false);
    expect(isReadyForResult('exploration', 0)).toBe(false);
  });

  it('경계값: 정확히 N턴(6)에서 false→true 로 전환 (off-by-one 가드)', () => {
    expect(isReadyForResult('exploration', 5)).toBe(false);
    expect(isReadyForResult('exploration', 6)).toBe(true);
  });

  it('opening phase 는 (주제 합의 전) 턴 수와 무관하게 준비 안 됨', () => {
    expect(isReadyForResult('opening', 0)).toBe(false);
    expect(isReadyForResult('opening', 10)).toBe(false);
  });

  it('echo_agreement phase 는 (합의만으론 방향성 없음) 준비 안 됨', () => {
    // ⚠️ 핵심 의도: 주제 합의 단계는 깊이가 충분해도 결과를 만들지 않는다.
    expect(isReadyForResult('echo_agreement', 0)).toBe(false);
    expect(isReadyForResult('echo_agreement', 99)).toBe(false);
  });

  it('상수 RESULT_READY_MIN_TURNS 는 6', () => {
    expect(RESULT_READY_MIN_TURNS).toBe(6);
  });
});
