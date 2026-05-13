export type Domain = "executing" | "influencing" | "relationship" | "strategic";

export interface Strength {
  id: string;
  name: string;
  nameEn: string;
  domain: Domain;
}

export interface DomainMeta {
  key: Domain;
  label: string;
  labelEn: string;
  description: string;
  color: string;
  bgColor: string;
}

export const DOMAINS: DomainMeta[] = [
  {
    key: "executing",
    label: "실행력",
    labelEn: "Executing",
    description: "결과를 만들어내고 일을 해내는 데 능한 강점들. "어떻게(How) 일을 끝낼 것인가"에 집중.",
    color: "#7C3AED",
    bgColor: "#F3EEFF",
  },
  {
    key: "influencing",
    label: "영향력",
    labelEn: "Influencing",
    description: "다른 사람을 설득하고 이끌며 변화를 만들어내는 강점들. 팀의 목소리를 키우고 메시지를 전달.",
    color: "#EA580C",
    bgColor: "#FFF1E6",
  },
  {
    key: "relationship",
    label: "대인관계 구축",
    labelEn: "Relationship Building",
    description: "사람들과 깊고 의미있는 관계를 만들고 팀의 결속력을 높이는 강점들.",
    color: "#2563EB",
    bgColor: "#E6EFFF",
  },
  {
    key: "strategic",
    label: "전략적 사고",
    labelEn: "Strategic Thinking",
    description: "정보를 분석하여 더 나은 결정을 내리고, 미래의 가능성을 그려내는 강점들.",
    color: "#059669",
    bgColor: "#E3F8EE",
  },
];

export const STRENGTHS: Strength[] = [
  // 실행력 (Executing) — 9개
  { id: "achiever",     name: "성취",     nameEn: "Achiever",     domain: "executing" },
  { id: "arranger",     name: "정리",     nameEn: "Arranger",     domain: "executing" },
  { id: "belief",       name: "신념",     nameEn: "Belief",       domain: "executing" },
  { id: "consistency",  name: "공정성",   nameEn: "Consistency",  domain: "executing" },
  { id: "deliberative", name: "심사숙고", nameEn: "Deliberative", domain: "executing" },
  { id: "discipline",   name: "체계",     nameEn: "Discipline",   domain: "executing" },
  { id: "focus",        name: "집중",     nameEn: "Focus",        domain: "executing" },
  { id: "responsibility", name: "책임",   nameEn: "Responsibility", domain: "executing" },
  { id: "restorative",  name: "복구",     nameEn: "Restorative",  domain: "executing" },

  // 영향력 (Influencing) — 8개
  { id: "activator",    name: "행동",     nameEn: "Activator",    domain: "influencing" },
  { id: "command",      name: "주도력",   nameEn: "Command",      domain: "influencing" },
  { id: "communication", name: "커뮤니케이션", nameEn: "Communication", domain: "influencing" },
  { id: "competition",  name: "승부",     nameEn: "Competition",  domain: "influencing" },
  { id: "maximizer",    name: "최상화",   nameEn: "Maximizer",    domain: "influencing" },
  { id: "self-assurance", name: "자기확신", nameEn: "Self-Assurance", domain: "influencing" },
  { id: "significance", name: "존재감",   nameEn: "Significance", domain: "influencing" },
  { id: "woo",          name: "사교성",   nameEn: "Woo",          domain: "influencing" },

  // 대인관계 구축 (Relationship Building) — 9개
  { id: "adaptability", name: "적응",     nameEn: "Adaptability", domain: "relationship" },
  { id: "connectedness", name: "연결성",  nameEn: "Connectedness", domain: "relationship" },
  { id: "developer",    name: "개발",     nameEn: "Developer",    domain: "relationship" },
  { id: "empathy",      name: "공감",     nameEn: "Empathy",      domain: "relationship" },
  { id: "harmony",      name: "화합",     nameEn: "Harmony",      domain: "relationship" },
  { id: "includer",     name: "포용",     nameEn: "Includer",     domain: "relationship" },
  { id: "individualization", name: "개별화", nameEn: "Individualization", domain: "relationship" },
  { id: "positivity",   name: "긍정",     nameEn: "Positivity",   domain: "relationship" },
  { id: "relator",      name: "절친",     nameEn: "Relator",      domain: "relationship" },

  // 전략적 사고 (Strategic Thinking) — 8개
  { id: "analytical",   name: "분석",     nameEn: "Analytical",   domain: "strategic" },
  { id: "context",      name: "회고",     nameEn: "Context",      domain: "strategic" },
  { id: "futuristic",   name: "미래지향", nameEn: "Futuristic",   domain: "strategic" },
  { id: "ideation",     name: "발상",     nameEn: "Ideation",     domain: "strategic" },
  { id: "input",        name: "수집",     nameEn: "Input",        domain: "strategic" },
  { id: "intellection", name: "지적사고", nameEn: "Intellection", domain: "strategic" },
  { id: "learner",      name: "배움",     nameEn: "Learner",      domain: "strategic" },
  { id: "strategic",    name: "전략",     nameEn: "Strategic",    domain: "strategic" },
];

export const STRENGTHS_BY_DOMAIN = DOMAINS.map((domain) => ({
  ...domain,
  strengths: STRENGTHS.filter((s) => s.domain === domain.key),
}));
