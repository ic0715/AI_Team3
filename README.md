# CareerPT

> 나를 잘 모르거나, 알아도 막연한 직장인이  
> AI 코치와의 대화를 통해 자기 자신을 발견하고,  
> 그 발견이 커리어 행동으로 이어지게 하는 서비스

---

## 서비스 흐름

```
회원가입 → 기본설문(3개) → 파일업로드
    ├── 파일 있음 → 첫 코칭 세션
    └── 파일 없음 → 보완 인터뷰(5개) → 첫 코칭 세션
```

---

## 문서 읽는 순서

| 문서 | 내용 |
|---|---|
| `docs/04_decisions/ADR_001.md` | 왜 이런 결정을 내렸는가 (여기서 시작) |
| `docs/01_why/MANIFESTO.md` | 왜 이 서비스인가 |
| `docs/01_why/TARGET_USER.md` | 누구를 위한 서비스인가 |
| `docs/02_what/SERVICE_CONCEPT.md` | 무엇을 만드는가 |
| `docs/02_what/USER_FLOW.md` | 사용자가 어떻게 경험하는가 |
| `docs/02_what/COACHING_DESIGN.md` | 코칭이 어떻게 동작하는가 |
| `docs/03_how/spec-ai-coaching.md` | 기술 구현 명세 |
| `ai/system_prompt_v2.md` | AI 코치 행동 원칙 |
| `ai/keyword_mapping.md` | 갤럽 34 키워드 매핑 |

---

## 팀

- **Auth** — Mingsunny
- **Onboarding** — Jaeyoung
- **Result Confirm** — Inchae
- **Main App** — Eunsang

## 기술 스택

- Next.js (App Router)
- Supabase (Auth + DB)
- Claude API (AI 코칭, claude-sonnet-4-20250514)
- Pretendard 폰트

## 로컬 실행

```bash
cd web
cp .env.example .env.local
# .env.local에 Supabase URL, anon key, Anthropic API key 입력
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속
