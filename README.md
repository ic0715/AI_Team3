# CareerPT — AI 커리어 코치

5-10년차 직장인의 성장 갭을 찾아주는 AI 코칭 서비스.

---

## 처음 왔다면 여기서 시작

| 파일 | 내용 |
|---|---|
| `docs/spec-schema.md` | **DB 테이블 정의** — 컬럼명·타입 공식 계약서 |
| `docs/spec-handoff.md` | **파트 간 연결 지점** — 내 파트가 끝나면 뭘 저장하고 어디로 넘기는지 |
| `docs/spec-auth.md` | 로그인/회원가입 동작 방식 |

---

## 파트별 담당

| 파트 | 담당 | 관련 파일 |
|---|---|---|
| Auth (로그인/회원가입) | Mingsunny | `pages/login.html`, `pages/reset_password.html` |
| Onboarding (기본설문·인터뷰·진단) |  | `pages/career_coaching_prototype_ver2.html` — Phase A |
| Result Confirm (진단결과 확인·1주일 계획) |  | `pages/career_coaching_prototype_ver2.html` — Phase B |
| Main App (홈·액션·회고) |  | `pages/career_coaching_prototype_ver2.html` — Phase C |

---

## 로컬 실행

**1. config.js 설정 (최초 1회)**

```bash
cp config.example.js config.js
```

`config.js`를 열어서 팀 채널에서 공유받은 Supabase key를 채워주세요.
`config.js`는 `.gitignore` 처리되어 있어서 GitHub에 올라가지 않아요.

**2. 서버 실행**

```bash
python3 -m http.server 3000
```

브라우저에서 `http://localhost:3000/pages/login.html` 접속.

> ⚠️ HTML 파일을 더블클릭(file://)으로 열면 Supabase 인증이 작동하지 않아요. 반드시 서버로 열어주세요.

---

## Supabase

| 항목 | 값 |
|---|---|
| Project URL | `https://fqgpfdzjiopajpeumlac.supabase.co` |
| 인증 방식 | 이메일+비밀번호, Google OAuth |
| anon key | `docs/spec-auth.md` 참고 |

---

## 스키마 변경할 때

1. `docs/spec-schema.md` 먼저 수정
2. PR 올리기
3. 팀원 확인 후 Supabase에 반영

코드보다 스펙 문서가 먼저입니다.
