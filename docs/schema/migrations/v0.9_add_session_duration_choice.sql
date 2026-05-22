-- =============================================================
-- v0.8 → v0.9 마이그레이션
-- 커리어 인터뷰 v2: session_duration_choice 컬럼 추가
-- 작성일: 2026-05-22
-- 관련 문서: docs/CAREER_INTERVIEW_V2_DECISIONS.md Part 7
-- 실행 위치: Supabase SQL Editor
-- 실행일: 2026-05-22 (민선)
-- =============================================================

ALTER TABLE career_interview_results
  ADD COLUMN session_duration_choice TEXT
  NOT NULL
  DEFAULT 'medium'
  CHECK (session_duration_choice IN ('short', 'medium', 'long'));

COMMENT ON COLUMN career_interview_results.session_duration_choice IS
  '인터뷰 시작 시 사용자가 답한 가용 시간 분류. AI가 자연어 응답을 보고 추출 단계에서 결정. short=15~25분, medium=30~45분, long=50분+';

-- =============================================================
-- key_insights nullable 변경
-- Path C(정서 위기 가드레일 작동) 시 key_insights = NULL로 저장하기 위해
-- =============================================================

ALTER TABLE career_interview_results
  ALTER COLUMN key_insights DROP NOT NULL;

-- =============================================================
-- 검증 쿼리 (실행 후 확인용)
-- =============================================================

-- 1. 컬럼 존재 확인
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'career_interview_results'
--    AND column_name = 'session_duration_choice';
-- 기대 결과: 행 1개, is_nullable = NO, column_default = 'medium'::text

-- 2. CHECK 제약 검증 (invalid_value로 INSERT 시도 → ERROR가 나야 정상)
-- INSERT INTO career_interview_results (user_id, key_insights, session_duration_choice, ai_summary)
-- VALUES (gen_random_uuid(), '{}'::jsonb, 'invalid_value', 'test');
-- → ERROR: new row for relation ... violates check constraint
