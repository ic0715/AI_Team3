export interface ActionItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

export interface ActionSeed {
  competencyId: string;
  emoji: string;
  items: ActionItem[];
}

export const ACTION_SEEDS: ActionSeed[] = [
  {
    competencyId: "critical-thinking",
    emoji: "🧠",
    items: [
      {
        id: "ct-a1",
        title: "TED 강연 1개 보고 핵심 논지와 근거 분석하기",
        description: "강연 하나를 보고 주장과 근거를 써보는 연습이에요.",
        tags: ["⏱ 1~2시간", "🆓 무료", "📝 분석"],
      },
      {
        id: "ct-a2",
        title: "신문 칼럼 읽고 반론 메모 3줄 써보기",
        description: "내 생각과 다른 칼럼을 골라 읽고, 논리적으로 반박해봐요.",
        tags: ["⏱ 30분", "✍️ 글쓰기", "매일 가능"],
      },
      {
        id: "ct-a3",
        title: '주변 의견에 "왜?" 라고 묻는 연습 매일 1회',
        description: '당연하게 받아들이는 주장에 "그 근거는?"을 물어봐요.',
        tags: ["⏱ 습관", "💬 대화"],
      },
      {
        id: "ct-a4",
        title: '책 "생각에 관한 생각" 1~2장 읽기',
        description: "대니얼 카너먼의 책으로 인지 편향과 비판적 사고의 기초를 배울 수 있어요.",
        tags: ["📚 독서", "⏱ 1~2시간"],
      },
      {
        id: "ct-a5",
        title: "케이스 스터디 1개 분석하고 내 의견 정리하기",
        description: '"내라면 어떻게 했을까?"를 논리적으로 써봐요.',
        tags: ["⏱ 1~2시간", "📄 분석", "주 1회"],
      },
    ],
  },
  {
    competencyId: "data-analysis",
    emoji: "📊",
    items: [
      {
        id: "da-a1",
        title: "SQL 기초 강의 1~3강 완강하기",
        description: "SELECT부터 JOIN까지 기초를 익혀요.",
        tags: ["💻 실습", "🆓 무료", "⏱ 3~4시간"],
      },
      {
        id: "da-a2",
        title: "엑셀 피벗 테이블로 데이터 정리 실습하기",
        description: "업무 데이터를 피벗 테이블로 분석해봐요.",
        tags: ["📊 엑셀", "⏱ 1~2시간"],
      },
      {
        id: "da-a3",
        title: "공개 데이터셋 1개 다운로드해 EDA 해보기",
        description: "Kaggle에서 데이터를 받아 기본 통계를 살펴봐요.",
        tags: ["🔍 탐색", "🆓 무료", "⏱ 2~3시간"],
      },
      {
        id: "da-a4",
        title: "구글 데이터 스튜디오로 시각화 대시보드 만들기",
        description: "스프레드시트를 연결해 간단한 차트 대시보드를 만들어봐요.",
        tags: ["📈 시각화", "🆓 무료", "⏱ 2시간"],
      },
      {
        id: "da-a5",
        title: "업무에서 매일 확인하는 지표 1개 정해서 추적하기",
        description: "내가 영향을 줄 수 있는 지표를 정하고 일주일 추이를 기록해봐요.",
        tags: ["📋 추적", "⏱ 매일 5분"],
      },
    ],
  },
  {
    competencyId: "communication",
    emoji: "🗣️",
    items: [
      {
        id: "cm-a1",
        title: "유명 발표 영상 1개 보고 구조와 전달 방식 분석하기",
        description: "TED를 보고 도입·본론·마무리 구조를 살펴봐요.",
        tags: ["🎙️ 발표", "⏱ 1시간", "🆓 무료"],
      },
      {
        id: "cm-a2",
        title: "1분 자기소개 스크립트 작성하고 다듬기",
        description: "면접·네트워킹 자리에서 바로 꺼낼 수 있는 자기소개를 만들어봐요.",
        tags: ["📝 글쓰기", "⏱ 1시간"],
      },
      {
        id: "cm-a3",
        title: "주 1회 짧은 블로그 글 작성하기",
        description: "배운 것, 생각한 것을 500자 이상 정리해봐요.",
        tags: ["✍️ 글쓰기", "주 1회"],
      },
      {
        id: "cm-a4",
        title: "팀 미팅에서 먼저 발언하기 주 3회 도전",
        description: "회의에서 가장 먼저 말하는 연습을 해봐요.",
        tags: ["🙋 발언", "주 3회", "💪 도전"],
      },
      {
        id: "cm-a5",
        title: "동료에게 내 발표·발언에 대한 피드백 요청하기",
        description: '"제 발표에서 아쉬운 부분이 있었나요?" 라고 먼저 물어봐요.',
        tags: ["💬 피드백", "🤝 협업"],
      },
    ],
  },
  {
    competencyId: "leadership",
    emoji: "🧭",
    items: [
      {
        id: "ld-a1",
        title: "팀원 1명과 1:1 미팅 잡기",
        description: "15~30분 짧은 1:1 미팅으로 팀원의 고민을 듣고 지지해봐요.",
        tags: ["🤝 관계", "⏱ 30분", "주 1회"],
      },
      {
        id: "ld-a2",
        title: '"팀이 나아갈 방향" 1페이지 문서 써보기',
        description: "지금 맡은 일의 목적과 방향을 한 장으로 정리해봐요.",
        tags: ["📄 문서화", "⏱ 1시간"],
      },
      {
        id: "ld-a3",
        title: "팀원에게 긍정적인 피드백 주 3회 전달하기",
        description: "어떤 부분이 좋았고 왜 의미있었는지 구체적으로 전달해봐요.",
        tags: ["💬 피드백", "주 3회"],
      },
      {
        id: "ld-a4",
        title: "리더십 관련 책 1챕터 읽고 내 상황에 적용해보기",
        description: '"팀장의 탄생" 같은 책으로 시작해봐요.',
        tags: ["📚 독서", "⏱ 1~2시간"],
      },
      {
        id: "ld-a5",
        title: "회의 때 결론과 다음 액션을 요약해서 공유하기",
        description: "회의가 끝날 때 정리해서 팀에 공유해요.",
        tags: ["📋 정리", "💬 소통", "매일"],
      },
    ],
  },
  {
    competencyId: "execution",
    emoji: "🚀",
    items: [
      {
        id: "ex-a1",
        title: "오늘 안에 끝낼 수 있는 작은 일 1개 바로 시작하기",
        description: '"완벽하게 준비되면"을 내려놓고, 지금 당장 첫 번째 단계를 밟아요.',
        tags: ["🚀 즉시 실행", "⏱ 오늘"],
      },
      {
        id: "ex-a2",
        title: "이번 주 목표 3개를 월요일 아침에 적어두기",
        description: "주 단위로 목표를 명확히 하고 금요일에 달성 여부를 확인해요.",
        tags: ["📋 계획", "주간 루틴"],
      },
      {
        id: "ex-a3",
        title: '미루고 있던 일 1개를 "2분 규칙"으로 처리하기',
        description: "2분 안에 끝낼 수 있는 일은 지금 바로 해요.",
        tags: ["⚡ 즉시 실행", "💡 습관"],
      },
      {
        id: "ex-a4",
        title: "프로젝트 아이디어를 72시간 안에 첫 단계 실행하기",
        description: "아이디어가 생기면 72시간 안에 딱 한 가지 행동을 해요.",
        tags: ["🎯 실행", "⏱ 72시간"],
      },
      {
        id: "ex-a5",
        title: "매일 저녁 5분, 오늘 한 일 3줄 회고하기",
        description: "오늘 실행한 것, 못 한 것, 내일 할 것을 짧게 적어요.",
        tags: ["📝 회고", "⏱ 5분", "매일"],
      },
    ],
  },
];

export const ACTION_SEEDS_BY_COMPETENCY = Object.fromEntries(
  ACTION_SEEDS.map((seed) => [seed.competencyId, seed])
);
