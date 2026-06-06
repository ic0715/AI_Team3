import { describe, expect, it } from 'vitest';
import {
  FORCE_CLOSE_FROM,
  STILL_OPEN_WARN_MARGIN,
  ENDING_KEYWORDS,
  detectEnding,
  countUserMessages,
  shouldForceClose,
  shouldWarnStillOpen,
} from './chatTurn';
import { COACH_CLOSING_KEYWORDS } from '@/lib/constants/career-interview';

type Msg = { role: 'user' | 'assistant'; content: string };

// ─────────────────────────────────────────────────────────────
// detectEnding — 코치 자연 종료 키워드 감지 (chat 라우트)
//   ⚠️ 클라이언트 COACH_CLOSING_KEYWORDS 와 정확히 동일해야 함 (CONTRACT_v2 §4.1)
// ─────────────────────────────────────────────────────────────
describe('detectEnding', () => {
  it('모든 종료 키워드를 단독으로 감지', () => {
    for (const k of ENDING_KEYWORDS) {
      expect(detectEnding(k)).toBe(true);
    }
  });

  it('문장 안에 포함돼도 감지 (substring)', () => {
    expect(detectEnding('자, 오늘 인터뷰는 여기서 마무리할게요!')).toBe(true);
  });

  it('일반 코치 발화는 false', () => {
    expect(detectEnding('조금 더 들려주시겠어요?')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(detectEnding('')).toBe(false);
  });

  it('ENDING_KEYWORDS 는 클라이언트 COACH_CLOSING_KEYWORDS 와 완전히 동일 (계약 동기화 가드)', () => {
    // 두 트랙(서버 chat 라우트 / 클라이언트 page)이 어긋나면 종료 분기가 깨진다.
    expect([...ENDING_KEYWORDS]).toEqual([...COACH_CLOSING_KEYWORDS]);
  });
});

// ─────────────────────────────────────────────────────────────
// countUserMessages
// ─────────────────────────────────────────────────────────────
describe('countUserMessages', () => {
  it('user 역할 메시지만 센다', () => {
    const msgs: Msg[] = [
      { role: 'assistant', content: '안녕하세요' },
      { role: 'user', content: '네' },
      { role: 'assistant', content: '음' },
      { role: 'user', content: '그렇군요' },
    ];
    expect(countUserMessages(msgs)).toBe(2);
  });

  it('빈 배열 → 0', () => {
    expect(countUserMessages([])).toBe(0);
  });

  it('assistant만 있으면 → 0', () => {
    expect(countUserMessages([{ role: 'assistant', content: 'a' }])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// shouldForceClose — FORCE_CLOSE_FROM(63) 경계
// ─────────────────────────────────────────────────────────────
describe('shouldForceClose', () => {
  it('FORCE_CLOSE_FROM 미만이면 false', () => {
    expect(shouldForceClose(FORCE_CLOSE_FROM - 1)).toBe(false);
    expect(shouldForceClose(0)).toBe(false);
  });

  it('정확히 FORCE_CLOSE_FROM(63)이면 true (경계 포함, off-by-one 가드)', () => {
    expect(shouldForceClose(FORCE_CLOSE_FROM)).toBe(true);
  });

  it('FORCE_CLOSE_FROM 초과면 true', () => {
    expect(shouldForceClose(FORCE_CLOSE_FROM + 10)).toBe(true);
  });

  it('FORCE_CLOSE_FROM 상수는 63', () => {
    expect(FORCE_CLOSE_FROM).toBe(63);
  });
});

// ─────────────────────────────────────────────────────────────
// shouldWarnStillOpen — FORCE_CLOSE_FROM + margin(7) 이후 미종료 경고
// ─────────────────────────────────────────────────────────────
describe('shouldWarnStillOpen', () => {
  const THRESHOLD = FORCE_CLOSE_FROM + STILL_OPEN_WARN_MARGIN; // 70

  it('이미 완료된 경우(isComplete=true)는 절대 경고 안 함', () => {
    expect(shouldWarnStillOpen(THRESHOLD, true)).toBe(false);
    expect(shouldWarnStillOpen(THRESHOLD + 100, true)).toBe(false);
  });

  it('threshold 미만이면 경고 안 함', () => {
    expect(shouldWarnStillOpen(THRESHOLD - 1, false)).toBe(false);
  });

  it('정확히 threshold(70)에서 경고 시작 (경계 포함)', () => {
    expect(shouldWarnStillOpen(THRESHOLD, false)).toBe(true);
  });

  it('threshold 초과 + 미완료면 경고', () => {
    expect(shouldWarnStillOpen(THRESHOLD + 5, false)).toBe(true);
  });

  it('STILL_OPEN_WARN_MARGIN 상수는 7', () => {
    expect(STILL_OPEN_WARN_MARGIN).toBe(7);
  });
});
