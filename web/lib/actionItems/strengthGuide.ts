/**
 * Top5 강점 → 강점별 실행 가이드(STRENGTH_BLOCKS) 해소.
 *
 * ⚠ 계약 주의: `strength_analyses.strengths`에 저장되는 행에는 `id`가 없다
 *   (buildStrengthsPayload가 {rank, name_ko, name_en, domain}만 저장 — id 드롭).
 *   그래서 과거 route의 `STRENGTH_BLOCKS[s.id]` 조회는 항상 미스 → 강점 가이드가 빈 채로
 *   생성 프롬프트에 들어가는 사일런트 버그가 있었다. 여기서는 **이름(name_ko/name_en)으로**
 *   블록 id를 해소해 그 틈을 막는다. (id가 있는 경로도 방어적으로 지원.)
 */
import { STRENGTHS } from '@/lib/constants/strengths';
import { STRENGTH_BLOCKS } from '@/lib/constants/strength_blocks';

// 한글명·영문명(소문자) → 블록 id (예: "분석"/"analytical" → "analytical")
const BLOCK_ID_BY_NAME = new Map<string, string>();
for (const st of STRENGTHS) {
  BLOCK_ID_BY_NAME.set(st.name, st.id);
  BLOCK_ID_BY_NAME.set(st.nameEn.toLowerCase(), st.id);
}

export interface NamedStrength {
  id?: string;
  name_ko?: string;
  name_en?: string;
}

/**
 * 사용자 Top5 강점 → { 한글강점명: bullets[] }.
 * 프롬프트 `[강점별 실행 가이드]`의 라벨 가독성을 위해 한글명으로 키잉한다.
 * 매칭 안 되는 강점은 조용히 제외(빈 결과 가능).
 */
export function resolveStrengthBlocks(strengths: NamedStrength[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of strengths) {
    const id =
      (s.id && STRENGTH_BLOCKS[s.id] ? s.id : undefined) ??
      (s.name_ko ? BLOCK_ID_BY_NAME.get(s.name_ko) : undefined) ??
      (s.name_en ? BLOCK_ID_BY_NAME.get(s.name_en.toLowerCase()) : undefined);
    const block = id ? STRENGTH_BLOCKS[id] : undefined;
    if (block && s.name_ko) out[s.name_ko] = block;
  }
  return out;
}
