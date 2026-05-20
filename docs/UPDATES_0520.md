# 문서 구조 업데이트 공지 — 2026-05-20

> 작성자: kathe  
> 관련 브랜치: `fix/css-variables-sync` · `docs/post-mvp-spec-v1.2`  
> 머지 전 팀 확인 요청

---

## 변경 배경

home_0520.html 프로토타입을 기반으로 post-MVP 화면 스펙이 새로 확정됐습니다.  
기존 `_post_mvp/` 폴더는 pivot 이전 설계안으로 보존하고,  
`_post_mvp_v2/` 폴더를 새로 만들어 구현 기준 스펙을 분리했습니다.

---

## 1. docs 폴더 구조 변경

### Before

```
docs/functional_spec/
├── _mvp/           ← MVP 스펙 (변경 없음)
└── _post_mvp/      ← post-MVP 스펙
```

### After

```
docs/functional_spec/
├── _mvp/           ← MVP 스펙 (변경 없음)
├── _post_mvp_v1/   ← pivot 이전 설계안 (rename, 보존용 — 수정 없음)
└── _post_mvp_v2/   ← home_0520.html 기반 심플 버전 (신규, 구현 기준)
    ├── 11_home.md
    ├── 12_reflect.md
    ├── 13_reflect_ai_coach.md
    └── 15_profile.md
```

> `_post_mvp_v1/` 안의 파일들은 내용 변경 없이 폴더명만 rename됐습니다.

---

## 2. 신규 추가 파일

### `docs/functional_spec/_post_mvp_v2/`

| 파일 | 화면 | 버전 | 핵심 내용 |
|------|------|------|-----------|
| `11_home.md` | 홈 (12주 코칭 대시보드) | v1.1 | 커리어 방향 카드 + 오늘의 액션 + 12주 타임라인. done/current/future 주차별 렌더링 로직 및 badge 기준 정의 |
| `12_reflect.md` | 회고 (평일 메모 / 주말 회고) | v1.1 | 날짜 기반 자동 모드 분기. 주말 회고 저장 후 AI 코칭 진입 CTA 포함 |
| `13_reflect_ai_coach.md` | 회고 AI 코칭 | v1.2 | p08 커리어 인터뷰와 동일 디자인 시스템 적용. 메인 코칭 종료 감지(`"오늘 코칭은 여기서 마무리하겠습니다"`)와 재협의 종료 감지(`---ACTION_REVISED---`)가 **다른 로직**임을 명시 |
| `15_profile.md` | 프로필 + 설정 | v1.1 | 기본 정보 인라인 편집 모드 + 비밀번호 변경(NEW07) 이동 포함 |

### `docs/ai_prompt/`

| 파일 | 버전 | 핵심 내용 |
|------|------|-----------|
| `06_reflect_coaching.md` | v1.2 | 회고 AI 코칭 전체 명세. 재협의 루프(#8) 추가, 완료 액션 제외 로직, 코치 자연 종료 방식. **`13_reflect_ai_coach.md` 구현 시 이 파일을 함께 참조** |

---

## 3. `_post_mvp_v1` vs `_post_mvp_v2` 차이

| | `_post_mvp_v1/` | `_post_mvp_v2/` |
|-|-----------------|-----------------|
| 기준 | pivot 이전 설계안 | home_0520.html 프로토타입 |
| 용도 | 보존 (참고용) | **구현 기준** |
| 포함 화면 | p11~p15, NEW03·NEW04·NEW07 등 | p11·p12·p13·p15 (심플 범위) |
| 상태 | 수정 예정 없음 | 현재 유효 |

> **post-MVP 구현 시 `_post_mvp_v2/` 파일을 기준으로 사용해주세요.**

---

## 4. CSS 변수 동기화 (`fix/css-variables-sync`)

`web/styles/globals.css`에 누락된 CSS 변수 5개를 추가했습니다.  
post-MVP 화면 구현 전에 이 PR이 먼저 머지돼야 합니다.

| 변수 | 값 | 용도 |
|------|----|------|
| `--ink-soft` | `#3f4651` | 보조 텍스트 (기존 `--ink`보다 밝음) |
| `--line` | `#e8eaee` | 얇은 구분선 |
| `--line-strong` | `#d3d7de` | 강조 구분선 |
| `--accent-soft` | `#dbeafe` | 액센트 배경 (연하게) |
| `--accent-tint` | `#eff6ff` | 액센트 배경 (가장 연하게) |

기존 변수 값도 프로토타입 기준으로 소폭 조정됐습니다:

| 변수 | 기존 | 변경 후 |
|------|------|---------|
| `--ink` | `#111827` | `#111418` |
| `--ink-mute` | `#9CA3AF` | `#8b93a0` |

> 현재 구현된 페이지들은 `--ink`, `--ink-mute`를 사용하지 않으므로 기존 화면에 영향 없습니다.

---

## 5. 열린 PR 목록

| PR | 브랜치 | 내용 | 우선순위 |
|----|--------|------|---------|
| [PR 생성 링크](https://github.com/ic0715/AI_Team3/pull/new/fix/css-variables-sync) | `fix/css-variables-sync` | CSS 변수 추가 (1 file) | 🔴 먼저 머지 |
| [PR 생성 링크](https://github.com/ic0715/AI_Team3/pull/new/docs/post-mvp-spec-v1.2) | `docs/post-mvp-spec-v1.2` | 스펙 문서 추가 (16 files) | 🟡 CSS 머지 후 |

---

## 6. 팀원 확인 요청 사항

### 필수 확인

- [ ] `_post_mvp/` → `_post_mvp_v1/` **rename에 동의**하시나요?  
  (보존용으로 유지. 파일 내용 변경 없음)

- [ ] `_post_mvp_v2/` 스펙 문서가 현재 home_0520.html 프로토타입과 **일치**하나요?  
  (p11·p12·p13·p15 범위)

- [ ] `06_reflect_coaching.md` v1.2 내용이 **의도한 AI 명세**와 맞나요?  
  (재협의 루프 #8, 완료 액션 제외 로직)

### 참고 사항

- `_post_mvp_v2/`에 **p14 히스토리가 없습니다** — 이번 스펙 범위에서 제외됐습니다. 추후 추가 예정이면 알려주세요.
- **NEW07 비밀번호 변경** 스펙은 `_post_mvp_v1/NEW07_password_change.md`에 기존 것이 있습니다. `_post_mvp_v2/`에도 추가가 필요하면 요청해주세요.
- post-MVP 구현은 MVP 완료 후 시작 예정 (`feature/home` 브랜치부터)

---

## 변경 이력

| 날짜 | 작업 |
|------|------|
| 2026-05-20 | 최초 작성. `fix/css-variables-sync` · `docs/post-mvp-spec-v1.2` 브랜치 변경 내용 공지 |
