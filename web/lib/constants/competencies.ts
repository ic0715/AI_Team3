export type FitLabel = "추천" | "강점 연계 높음" | "성장 잠재력 높음";

export interface Competency {
  id: string;
  title: string;
  fit: FitLabel;
  description: string;
  tags: string[];
  emoji: string;
}

export const COMPETENCIES: Competency[] = [
  {
    id: "critical-thinking",
    title: "비판적 사고 기르기",
    fit: "강점 연계 높음",
    description: "정보를 그대로 받아들이지 않고 근거와 논리를 따져보는 습관이에요.",
    tags: ["🔍 논리적 사고", "📌 근거 기반 판단", "💡 문제 정의력"],
    emoji: "🧠",
  },
  {
    id: "data-analysis",
    title: "데이터 분석 능력 기르기",
    fit: "강점 연계 높음",
    description: "숫자와 데이터를 읽고 인사이트를 뽑아내는 능력이에요.",
    tags: ["📊 데이터 읽기", "🧮 SQL / 엑셀", "📈 인사이트 도출"],
    emoji: "📊",
  },
  {
    id: "communication",
    title: "커뮤니케이션 능력 기르기",
    fit: "성장 잠재력 높음",
    description: "내 생각을 명확하게 전달하고 상대의 이야기를 제대로 듣는 능력이에요.",
    tags: ["🗣️ 발표·설득", "✍️ 글쓰기", "👂 적극적 경청"],
    emoji: "🗣️",
  },
  {
    id: "leadership",
    title: "리더십 역량 기르기",
    fit: "성장 잠재력 높음",
    description: "팀을 이끌고 방향을 제시하며 구성원이 잘 성장하도록 돕는 능력이에요.",
    tags: ["🧭 방향 제시", "🤝 팀 빌딩", "💬 피드백 주고받기"],
    emoji: "🧭",
  },
  {
    id: "execution",
    title: "실행력·추진력 기르기",
    fit: "추천",
    description: "계획을 행동으로 옮기고, 불확실한 상황에서도 먼저 시작하는 능력이에요.",
    tags: ["🚀 빠른 실행", "🔄 반복 개선", "🎯 목표 완수"],
    emoji: "🚀",
  },
];

export const DEFAULT_COMPETENCY_ID = "critical-thinking";
