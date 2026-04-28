export type Emotion = "satisfaction" | "anxiety" | "stagnation" | "transition";

export interface OnboardingData {
  // Step 1
  name: string;
  age: string;
  company: string;
  tenure: string;
  emotions: Emotion[];
  currentRole: string;
  concerns: string;
  // Step 2
  files: { name: string; size: number; content?: string; mimeType?: string }[];
  directText: string;
  // Step 3
  interviewAnswers: { question: string; answer: string }[];
}

export interface DiagnosisResult {
  summary: string;
  keywords: string[];
  strengths: string[];
  improvements: string[];
  goals: { period: string; description: string }[];
  competencies: {
    name: string;
    current: number;
    target: number;
  }[];
}

export const INTERVIEW_QUESTIONS = [
  { id: 1, category: "자기이해", text: "지금 하는 일에서 가장 보람을 느끼는 순간은 언제인가요?" },
  { id: 2, category: "강점", text: "동료나 상사로부터 가장 자주 칭찬받는 능력은 무엇인가요?" },
  { id: 3, category: "현재 역할", text: "현재 직무에서 가장 어려운 부분은 무엇인가요?" },
  { id: 4, category: "강점", text: "본인이 생각하는 가장 큰 강점 세 가지는 무엇인가요?" },
  { id: 5, category: "자기이해", text: "어떤 환경에서 가장 높은 성과를 내나요?" },
  { id: 6, category: "장애물", text: "커리어 성장에서 가장 큰 걸림돌은 무엇이라고 생각하나요?" },
  { id: 7, category: "목표", text: "3년 후 어떤 모습이 되고 싶으신가요?" },
  { id: 8, category: "현재 역할", text: "현재 팀이나 조직에서 본인의 역할을 어떻게 정의하시나요?" },
  { id: 9, category: "목표", text: "커리어에서 가장 중요하게 여기는 가치는 무엇인가요?" },
  { id: 10, category: "자기이해", text: "지금까지 가장 성취감을 느꼈던 프로젝트나 경험은 무엇인가요?" },
];

export const TENURE_OPTIONS = [
  "6개월 미만", "6개월~1년", "1~3년", "3~5년", "5년 이상"
];

export const EMOTION_LABELS: Record<Emotion, string> = {
  satisfaction: "만족감",
  anxiety: "불안감",
  stagnation: "정체감",
  transition: "전환 필요",
};
