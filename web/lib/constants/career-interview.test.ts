import { describe, expect, it } from 'vitest';
import {
  buildRunningStatePrefix,
  classifySessionDuration,
  COACH_CLOSING_KEYWORDS,
  CRISIS_RED_KEYWORDS,
  detectCoachClosing,
  detectCrisisRed,
  detectUserExit,
  ECHO_AGREEMENT_FALLBACK_TURNS,
  inferPhase,
  USER_EXIT_KEYWORDS,
} from './career-interview';

// ─────────────────────────────────────────────────────────────
// detectCoachClosing — Path A 코치 자연 종료 키워드
// ─────────────────────────────────────────────────────────────
describe('detectCoachClosing', () => {
  it('정의된 모든 키워드를 단독으로 감지', () => {
    for (const k of COACH_CLOSING_KEYWORDS) {
      expect(detectCoachClosing(k)).toBe(true);
    }
  });

  it('키워드가 더 긴 문장 안에 포함돼도 감지 (substring)', () => {
    expect(detectCoachClosing('자, 오늘 인터뷰는 여기서 마무리할게요. 고생하셨어요!')).toBe(true);
    expect(detectCoachClosing('그럼 오늘은 여기까지 하고 정리해볼게요')).toBe(true);
  });

  it('일반 코치 발화는 false', () => {
    expect(detectCoachClosing('조금 더 이야기 나눠볼까요?')).toBe(false);
    expect(detectCoachClosing('어떤 점이 가장 마음에 걸리세요?')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(detectCoachClosing('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// detectUserExit — Path B 사용자 주도 종료 키워드
// ─────────────────────────────────────────────────────────────
describe('detectUserExit', () => {
  it('정의된 모든 키워드를 단독으로 감지', () => {
    for (const k of USER_EXIT_KEYWORDS) {
      expect(detectUserExit(k)).toBe(true);
    }
  });

  it('키워드가 문장 안에 포함돼도 감지', () => {
    expect(detectUserExit('오늘은 좀 피곤해서 이제 됐어요')).toBe(true);
    expect(detectUserExit('미안하지만 그만하고 싶어요...')).toBe(true);
  });

  it('일반 답변은 false', () => {
    expect(detectUserExit('네, 더 이야기해볼게요')).toBe(false);
    expect(detectUserExit('요즘 이직을 고민하고 있어요')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(detectUserExit('')).toBe(false);
  });

  it('"오늘은 여기까지"는 coach/user 양쪽 키워드에 모두 존재 (의도된 중복)', () => {
    // 이 문구는 코치도 사용자도 쓸 수 있으므로 두 감지기 모두 true.
    // 호출부에서 user 입력 / coach 응답을 구분해 분기하므로 충돌 없음.
    expect(detectUserExit('오늘은 여기까지')).toBe(true);
    expect(detectCoachClosing('오늘은 여기까지')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// detectCrisisRed — Path C 정서 위기 (안전 가드레일 백업)
// ─────────────────────────────────────────────────────────────
describe('detectCrisisRed', () => {
  it('정의된 모든 위기 키워드를 단독으로 감지', () => {
    for (const k of CRISIS_RED_KEYWORDS) {
      expect(detectCrisisRed(k)).toBe(true);
    }
  });

  it('키워드가 문장 안에 포함돼도 감지', () => {
    expect(detectCrisisRed('요즘 너무 힘들어서 죽고 싶다는 생각만 들어요')).toBe(true);
    expect(detectCrisisRed('그냥 다 사라지고 싶다')).toBe(true);
  });

  it('위기 키워드가 없는 일반적 고충은 false', () => {
    expect(detectCrisisRed('일이 너무 많아서 지치네요')).toBe(false);
    expect(detectCrisisRed('퇴사하고 싶어요')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(detectCrisisRed('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// classifySessionDuration — 첫 시간 응답 분류 (추정치)
// ─────────────────────────────────────────────────────────────
describe('classifySessionDuration', () => {
  it('짧음 신호 → short', () => {
    expect(classifySessionDuration('15분 정도요')).toBe('short');
    expect(classifySessionDuration('20분밖에 없어요')).toBe('short');
    expect(classifySessionDuration('짧게 부탁해요')).toBe('short');
    expect(classifySessionDuration('좀 급해서요')).toBe('short');
  });

  it('충분 신호 → long', () => {
    expect(classifySessionDuration('1시간 정도 가능해요')).toBe('long');
    expect(classifySessionDuration('오늘은 충분히 시간 있어요')).toBe('long');
    expect(classifySessionDuration('시간 많아요')).toBe('long');
  });

  it('보통 신호 → medium', () => {
    expect(classifySessionDuration('30분이면 될 것 같아요')).toBe('medium');
    expect(classifySessionDuration('40분 정도요')).toBe('medium');
    expect(classifySessionDuration('보통이요')).toBe('medium');
  });

  it('모호하거나 신호 없음 → medium (기본값)', () => {
    expect(classifySessionDuration('글쎄요')).toBe('medium');
    expect(classifySessionDuration('잘 모르겠어요')).toBe('medium');
    expect(classifySessionDuration('')).toBe('medium');
  });

  it('우선순위: short가 long/medium보다 먼저 평가됨', () => {
    // "20분"(short) + "시간 많"(long) 동시 등장 → short 우선
    expect(classifySessionDuration('20분인데 그래도 시간 많아요')).toBe('short');
    // "15분"(short) + "30분"(medium) 동시 → short 우선
    expect(classifySessionDuration('15분에서 30분 사이요')).toBe('short');
  });

  it('우선순위: long이 medium보다 먼저 평가됨', () => {
    // "충분히"(long) + "30분"(medium) 동시 → long 우선
    expect(classifySessionDuration('30분이면 충분히 될 것 같아요')).toBe('long');
  });
});

// ─────────────────────────────────────────────────────────────
// buildRunningStatePrefix — AI 전송용 <현재_상태> 블록
// ─────────────────────────────────────────────────────────────
describe('buildRunningStatePrefix', () => {
  it('모든 필드를 정확히 보간하고 trailing newline 포함', () => {
    const out = buildRunningStatePrefix({
      phase: 'exploration',
      agreedFocus: '이직 고민',
      turnCount: 3,
      sessionDuration: 'medium',
    });
    expect(out).toBe(
      [
        '<현재_상태>',
        'phase: exploration',
        'agreed_focus: "이직 고민"',
        'turn_count: 3',
        'session_duration: medium',
        '</현재_상태>',
        '',
      ].join('\n'),
    );
  });

  it('agreedFocus가 빈 문자열이면 빈 따옴표로 렌더', () => {
    const out = buildRunningStatePrefix({
      phase: 'opening',
      agreedFocus: '',
      turnCount: 1,
      sessionDuration: 'short',
    });
    expect(out).toContain('agreed_focus: ""');
    expect(out).toContain('phase: opening');
    expect(out).toContain('turn_count: 1');
    expect(out).toContain('session_duration: short');
  });

  it('prefix로 본문 앞에 붙이면 본문이 블록 뒤에 옴', () => {
    const prefix = buildRunningStatePrefix({
      phase: 'echo_agreement',
      agreedFocus: '',
      turnCount: 2,
      sessionDuration: 'long',
    });
    const body = '안녕하세요';
    expect((prefix + body).endsWith('</현재_상태>\n안녕하세요')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// inferPhase — phase 자동 전환 상태머신
// ─────────────────────────────────────────────────────────────
describe('inferPhase', () => {
  it('코치 종료 발화 감지 시 current와 무관하게 closing', () => {
    expect(inferPhase('opening', '오늘 인터뷰는 여기서 마칠게요', 0).phase).toBe('closing');
    expect(inferPhase('exploration', '오늘은 여기까지 하고 정리해요', 5).phase).toBe('closing');
    expect(inferPhase('echo_agreement', '여기서 마무리할게요', 2).phase).toBe('closing');
  });

  it('echo_agreement + mirror 발화 → exploration & agreedFocus 캡처', () => {
    const r = inferPhase(
      'echo_agreement',
      '그럼 오늘은 이직 고민을 같이 다뤄볼게요',
      1,
    );
    expect(r.phase).toBe('exploration');
    expect(r.agreedFocus).toBe('이직 고민');
  });

  it('mirror 캡처는 앞뒤 공백을 trim', () => {
    const r = inferPhase(
      'echo_agreement',
      '그럼 오늘은   성장 방향  을 봐볼게요',
      1,
    );
    expect(r.phase).toBe('exploration');
    expect(r.agreedFocus).toBe('성장 방향');
  });

  it('echo_agreement인데 mirror 패턴이 없으면 phase 유지 (폴백 임계 미만)', () => {
    const r = inferPhase('echo_agreement', '조금 더 들려주시겠어요?', 1);
    expect(r.phase).toBe('echo_agreement');
    expect(r.agreedFocus).toBeUndefined();
  });

  it('echo_agreement + mirror 없이 폴백 임계 턴 이상 → exploration 강제 전환 (agreedFocus 미캡처)', () => {
    // 임계 직전(2턴)까지는 유지
    expect(inferPhase('echo_agreement', '조금 더 들려주시겠어요?', ECHO_AGREEMENT_FALLBACK_TURNS - 1).phase)
      .toBe('echo_agreement');
    // 임계(3턴) 이상이면 미러링 문구가 없어도 exploration 으로 전환
    const r = inferPhase('echo_agreement', '조금 더 들려주시겠어요?', ECHO_AGREEMENT_FALLBACK_TURNS);
    expect(r.phase).toBe('exploration');
    expect(r.agreedFocus).toBeUndefined();
  });

  it('opening + 첫 사용자 응답(>=1) → echo_agreement', () => {
    expect(inferPhase('opening', '네, 어떤 게 고민이세요?', 1).phase).toBe('echo_agreement');
  });

  it('opening + 사용자 응답 없음(0) → opening 유지', () => {
    expect(inferPhase('opening', '안녕하세요! 오늘 시간 어떠세요?', 0).phase).toBe('opening');
  });

  it('exploration + G패턴(마무리 직전 질문) → closing', () => {
    expect(
      inferPhase('exploration', '오늘 어떤 게 손에 잡히는 느낌이 드세요?', 4).phase,
    ).toBe('closing');
    expect(inferPhase('exploration', '새롭게 알게 된 게 있을까요?', 6).phase).toBe('closing');
  });

  it('exploration + 일반 질문 → exploration 유지', () => {
    const r = inferPhase('exploration', '그 부분 좀 더 말씀해주실래요?', 4);
    expect(r.phase).toBe('exploration');
    expect(r.agreedFocus).toBeUndefined();
  });

  it('closing 키워드가 mirror/G패턴보다 우선', () => {
    // mirror 패턴 + 종료 키워드가 같이 있으면 closing이 이김
    const r = inferPhase(
      'echo_agreement',
      '그럼 오늘은 이직을 다뤄볼게요. 그리고 오늘은 여기까지 할게요',
      1,
    );
    expect(r.phase).toBe('closing');
    expect(r.agreedFocus).toBeUndefined();
  });
});
