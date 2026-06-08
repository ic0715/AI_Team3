// 12역량 정의 (docs/ai_prompt/04.competency_analysis.md §1 기반)
// 각 역량마다 연계 강점 5개(Korean name) — Step1 결정적 매칭에 사용
import type { Domain } from './strengths';

export type FitLabel = '추천' | '강점 연계 높음' | '성장 잠재력 높음';

// 역량 방향 결과(#3) 화면에 노출하는 추천 역량 카드 개수.
// deterministicMatch의 슬롯 상한(의도 우선 채움 + 부족분 강점 보충)이 이 값을 공유한다.
// (액션 화면의 ACTION_DISPLAY_COUNT(seeds.ts)와 같은 표출-개수 상수 패턴)
export const COMPETENCY_DISPLAY_COUNT = 3;

export interface Competency {
  id: string;                // slug (예: "critical-thinking")
  code: string;              // DB CHECK constraint 코드 (예: "T-1")
  domain: Domain;            // 갤럽 도메인 (strategic/influencing/relationship/executing)
  domainCode: 'T' | 'I' | 'R' | 'E';
  title: string;             // 사용자 표시 제목 (예: "비판적 사고 기르기")
  tags: string[];
  emoji: string;
  linkedStrengths: string[]; // 연계 강점 5개 (한글 정규명)
  /** @deprecated 이전 mock UI용. 이제 deterministicMatch가 동적으로 결정. */
  fit?: FitLabel;
  /** @deprecated 이제 AI가 personalizedText 생성. */
  description?: string;
}

export const COMPETENCIES: Competency[] = [
  // ── Thinking (T) ───────────────────────────────────────
  {
    id: 'critical-thinking',
    code: 'T-1',
    domain: 'strategic',
    domainCode: 'T',
    title: '비판적 사고 기르기',
    tags: ['🔍 논리적 사고', '📌 근거 기반 판단', '💡 문제 정의력'],
    emoji: '🧠',
    linkedStrengths: ['분석', '전략', '지적사고', '회고', '수집'],
  },
  {
    id: 'data-analysis',
    code: 'T-2',
    domain: 'strategic',
    domainCode: 'T',
    title: '데이터 분석 능력 기르기',
    tags: ['📊 데이터 읽기', '🧮 SQL / 엑셀', '📈 인사이트 도출'],
    emoji: '📊',
    linkedStrengths: ['분석', '전략', '수집', '배움', '미래지향'],
  },
  {
    id: 'planning',
    code: 'T-3',
    domain: 'strategic',
    domainCode: 'T',
    title: '기획력 기르기',
    tags: ['🗺️ 큰 그림', '🎯 목표 구조화', '📐 로드맵'],
    emoji: '🗺️',
    linkedStrengths: ['전략', '미래지향', '발상', '분석', '집중'],
  },
  // ── Influencing (I) ────────────────────────────────────
  {
    id: 'communication',
    code: 'I-1',
    domain: 'influencing',
    domainCode: 'I',
    title: '커뮤니케이션 능력 기르기',
    tags: ['🗣️ 발표·설득', '✍️ 글쓰기', '👂 적극적 경청'],
    emoji: '🗣️',
    linkedStrengths: ['커뮤니케이션', '사교성', '존재감', '주도력', '긍정'],
  },
  {
    id: 'leadership',
    code: 'I-2',
    domain: 'influencing',
    domainCode: 'I',
    title: '리더십 역량 기르기',
    tags: ['🧭 방향 제시', '🤝 팀 빌딩', '💬 피드백 주고받기'],
    emoji: '🧭',
    linkedStrengths: ['주도력', '자기확신', '존재감', '행동', '최상화'],
  },
  {
    id: 'persuasion',
    code: 'I-3',
    domain: 'influencing',
    domainCode: 'I',
    title: '설득·협상력 기르기',
    tags: ['🤝 합의 도출', '⚖️ 이해관계 조율', '💼 윈윈 만들기'],
    emoji: '🤝',
    linkedStrengths: ['커뮤니케이션', '사교성', '승부', '주도력', '자기확신'],
  },
  // ── Relationship (R) ───────────────────────────────────
  {
    id: 'collaboration',
    code: 'R-1',
    domain: 'relationship',
    domainCode: 'R',
    title: '협업 능력 기르기',
    tags: ['🧩 팀워크', '🌉 크로스팀', '✨ 다양성 활용'],
    emoji: '🧩',
    linkedStrengths: ['화합', '포용', '개별화', '긍정', '절친'],
  },
  {
    id: 'mentoring',
    code: 'R-2',
    domain: 'relationship',
    domainCode: 'R',
    title: '코칭·멘토링 역량 기르기',
    tags: ['🌱 성장 지원', '👥 1:1 미팅', '💎 잠재력 발굴'],
    emoji: '🌱',
    linkedStrengths: ['개발', '공감', '개별화', '절친', '긍정'],
  },
  {
    id: 'empathy-comm',
    code: 'R-3',
    domain: 'relationship',
    domainCode: 'R',
    title: '공감 소통 기르기',
    tags: ['💗 감정 읽기', '🤲 안전감', '🧠 상대 입장 듣기'],
    emoji: '💗',
    linkedStrengths: ['공감', '화합', '연결성', '포용', '긍정'],
  },
  // ── Executing (E) ──────────────────────────────────────
  {
    id: 'execution',
    code: 'E-1',
    domain: 'executing',
    domainCode: 'E',
    title: '실행력·추진력 기르기',
    tags: ['🚀 빠른 실행', '🔄 반복 개선', '🎯 목표 완수'],
    emoji: '🚀',
    linkedStrengths: ['행동', '성취', '집중', '책임', '신념'],
  },
  {
    id: 'problem-solving',
    code: 'E-2',
    domain: 'executing',
    domainCode: 'E',
    title: '문제해결력 기르기',
    tags: ['🔧 트러블슈팅', '🔬 근본 원인', '🛡️ 리스크 관리'],
    emoji: '🔧',
    linkedStrengths: ['복구', '분석', '전략', '행동', '심사숙고'],
  },
  {
    id: 'self-management',
    code: 'E-3',
    domain: 'executing',
    domainCode: 'E',
    title: '자기관리 역량 기르기',
    tags: ['⏱️ 시간관리', '🔋 에너지 배분', '🧘 회복'],
    emoji: '⏱️',
    linkedStrengths: ['성취', '집중', '체계', '책임', '심사숙고'],
  },
];

export const DEFAULT_COMPETENCY_ID = 'execution';

// 헬퍼: id로 lookup
export const COMPETENCY_BY_ID: Record<string, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
);

// 헬퍼: code(T-1 등)로 lookup
export const COMPETENCY_BY_CODE: Record<string, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.code, c]),
);
