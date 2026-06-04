import { describe, expect, it } from 'vitest';
import {
  ACTION_SEEDS,
  ACTION_SEEDS_BY_COMPETENCY,
  type SeedEffort,
  type SeedLevel,
} from './seeds';
import { CODE_TO_SLUG } from '@/lib/actionItems/seedMapping';

const VALID_LEVELS: SeedLevel[] = ['junior', 'senior', 'any'];
const VALID_EFFORTS: SeedEffort[] = ['quick', 'deep', 'habit'];

describe('ACTION_SEEDS 무결성', () => {
  it('12역량 모두 시드를 가진다', () => {
    expect(ACTION_SEEDS).toHaveLength(12);
  });

  it('모든 시드 id는 전역 고유 (source_seed_id 추적 안정성)', () => {
    const allIds = ACTION_SEEDS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('competencyId 슬러그는 CODE_TO_SLUG와 일치하고 code 매핑이 맞다', () => {
    for (const seed of ACTION_SEEDS) {
      expect(CODE_TO_SLUG[seed.code]).toBe(seed.competencyId);
    }
  });

  it('각 역량은 SSoT 6개(주니어3+시니어3) 이상을 갖는다', () => {
    for (const seed of ACTION_SEEDS) {
      const junior = seed.items.filter((i) => i.level === 'junior').length;
      const senior = seed.items.filter((i) => i.level === 'senior').length;
      expect(junior).toBeGreaterThanOrEqual(3);
      expect(senior).toBeGreaterThanOrEqual(3);
    }
  });

  it('모든 항목의 level/effort 값이 유효하고 필수 필드가 채워져 있다', () => {
    for (const seed of ACTION_SEEDS) {
      for (const item of seed.items) {
        expect(VALID_LEVELS).toContain(item.level);
        expect(VALID_EFFORTS).toContain(item.effort);
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('SSoT 파생 id 형식 {code}-{junior|senior|extra}-{n} 및 level 일치', () => {
    const re = /^[A-Z]-\d+-(junior|senior|extra)-\d+$/;
    for (const seed of ACTION_SEEDS) {
      for (const item of seed.items) {
        expect(item.id).toMatch(re);
        expect(item.id.startsWith(`${seed.code}-`)).toBe(true);
        // id의 레벨 토큰이 junior/senior면 item.level과 일치해야 한다(드리프트 방지).
        const token = item.id.split('-')[2]; // code는 "T-1" 형태라 인덱스 2가 레벨 토큰
        if (token === 'junior' || token === 'senior') {
          expect(item.level).toBe(token);
        } else {
          expect(item.level).toBe('any'); // extra → level 'any'
        }
      }
    }
  });

  it('각 역량은 effort가 2종 이상 섞여 있다 (포맷 다양성 보장)', () => {
    for (const seed of ACTION_SEEDS) {
      const efforts = new Set(seed.items.map((i) => i.effort));
      expect(efforts.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('ACTION_SEEDS_BY_COMPETENCY 인덱스가 모든 역량을 포함한다', () => {
    for (const seed of ACTION_SEEDS) {
      expect(ACTION_SEEDS_BY_COMPETENCY[seed.competencyId]).toBe(seed);
    }
  });
});
