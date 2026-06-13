import { describe, it, expect } from 'vitest';
import {
  STATE_BLOCK_RE,
  stripStateBlock,
  toDisplayMessages,
  countUserMessages,
  pickInterviewSummary,
  extractInsightHighlights,
  formatInterviewDate,
  type DisplayMessage,
} from './interviewLog';

describe('stripStateBlock', () => {
  it('user content 앞의 <현재_상태> 블록을 제거하고 trim 한다', () => {
    const raw = '<현재_상태>phase: exploration\nturn: 3</현재_상태>\n실제 사용자 발화입니다';
    expect(stripStateBlock(raw)).toBe('실제 사용자 발화입니다');
  });

  it('상태 블록이 없으면 trim 만 적용', () => {
    expect(stripStateBlock('  그냥 답변  ')).toBe('그냥 답변');
  });

  it('블록만 있고 본문이 없으면 빈 문자열', () => {
    expect(stripStateBlock('<현재_상태>x</현재_상태>\n')).toBe('');
  });

  it('블록은 맨 앞에 있을 때만 제거(중간 등장은 보존)', () => {
    const raw = '먼저 말하고 <현재_상태>x</현재_상태> 뒤에 더';
    expect(stripStateBlock(raw)).toBe(raw);
  });

  it('정규식은 멀티라인 블록을 non-greedy 로 매칭', () => {
    expect(STATE_BLOCK_RE.test('<현재_상태>\na\nb\n</현재_상태>\n안녕')).toBe(true);
  });
});

describe('toDisplayMessages', () => {
  it('배열이 아니면 빈 배열', () => {
    expect(toDisplayMessages(null)).toEqual([]);
    expect(toDisplayMessages(undefined)).toEqual([]);
    expect(toDisplayMessages('x')).toEqual([]);
    expect(toDisplayMessages({})).toEqual([]);
  });

  it('user 는 상태블록 제거, assistant 는 trim 만', () => {
    const raw = [
      { role: 'assistant', content: '  안녕하세요  ' },
      { role: 'user', content: '<현재_상태>p</현재_상태>\n네 안녕하세요' },
    ];
    expect(toDisplayMessages(raw)).toEqual<DisplayMessage[]>([
      { role: 'assistant', text: '안녕하세요' },
      { role: 'user', text: '네 안녕하세요' },
    ]);
  });

  it('손상 항목(잘못된 role / 비문자열 content / null)은 제외', () => {
    const raw = [
      { role: 'system', content: 'x' },
      { role: 'user', content: 123 },
      null,
      'string',
      { role: 'assistant', content: '정상' },
    ];
    expect(toDisplayMessages(raw)).toEqual<DisplayMessage[]>([
      { role: 'assistant', text: '정상' },
    ]);
  });

  it('정제 후 빈 문자열이 되는 메시지는 제외', () => {
    const raw = [
      { role: 'user', content: '<현재_상태>x</현재_상태>\n' },
      { role: 'assistant', content: '   ' },
      { role: 'user', content: '<현재_상태>x</현재_상태>\n실제 발화' },
    ];
    expect(toDisplayMessages(raw)).toEqual<DisplayMessage[]>([
      { role: 'user', text: '실제 발화' },
    ]);
  });
});

describe('countUserMessages', () => {
  it('user 역할만 센다', () => {
    const msgs: DisplayMessage[] = [
      { role: 'user', text: 'a' },
      { role: 'assistant', text: 'b' },
      { role: 'user', text: 'c' },
    ];
    expect(countUserMessages(msgs)).toBe(2);
  });

  it('빈 배열은 0', () => {
    expect(countUserMessages([])).toBe(0);
  });
});

describe('pickInterviewSummary', () => {
  it('conversation_summary 가 있으면 우선', () => {
    expect(pickInterviewSummary('대화 요약', 'AI 요약')).toBe('대화 요약');
  });

  it('conversation_summary 가 비면 ai_summary 폴백', () => {
    expect(pickInterviewSummary('', 'AI 요약')).toBe('AI 요약');
    expect(pickInterviewSummary('   ', 'AI 요약')).toBe('AI 요약');
    expect(pickInterviewSummary(null, 'AI 요약')).toBe('AI 요약');
  });

  it('둘 다 비면 빈 문자열', () => {
    expect(pickInterviewSummary(null, null)).toBe('');
    expect(pickInterviewSummary(undefined, '  ')).toBe('');
  });

  it('양끝 공백은 제거', () => {
    expect(pickInterviewSummary('  요약  ', null)).toBe('요약');
  });
});

describe('extractInsightHighlights', () => {
  it('null/비객체는 모두 빈 문자열', () => {
    const empty = { presentingIssue: '', agreedFocus: '', takeaway: '' };
    expect(extractInsightHighlights(null)).toEqual(empty);
    expect(extractInsightHighlights(undefined)).toEqual(empty);
    expect(extractInsightHighlights('x')).toEqual(empty);
  });

  it('3개 핵심 키를 추출하고 trim', () => {
    expect(
      extractInsightHighlights({
        presenting_issue: '  이직 고민  ',
        agreed_focus: '리더십 역량',
        user_takeaway: '작게 시작하자',
      }),
    ).toEqual({
      presentingIssue: '이직 고민',
      agreedFocus: '리더십 역량',
      takeaway: '작게 시작하자',
    });
  });

  it('일부 키 누락/비문자열은 빈 문자열로 폴백', () => {
    expect(
      extractInsightHighlights({ agreed_focus: '주제만 있음', user_takeaway: 42 }),
    ).toEqual({ presentingIssue: '', agreedFocus: '주제만 있음', takeaway: '' });
  });
});

describe('formatInterviewDate', () => {
  it('ISO → YYYY.MM.DD (월/일 zero-pad)', () => {
    expect(formatInterviewDate('2026-06-13T09:08:00.000Z')).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it('월/일 한 자리도 2자리로 패딩', () => {
    // 로컬 타임존 영향을 피하려 시각을 정오로 둠
    expect(formatInterviewDate('2026-03-05T12:00:00')).toBe('2026.03.05');
  });

  it('null/빈값/파싱 실패는 빈 문자열', () => {
    expect(formatInterviewDate(null)).toBe('');
    expect(formatInterviewDate(undefined)).toBe('');
    expect(formatInterviewDate('')).toBe('');
    expect(formatInterviewDate('not-a-date')).toBe('');
  });
});
