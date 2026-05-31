"""CLI 진입점 — 12주 retention 시뮬레이션 실행.

사용법:
  # 실제 ralph_loop 라운드 결과가 있을 때
  python -m retention_sim.run_retention --round 1

  # 실제 데이터 없이 합성 스코어로 분석 (방법 B 기본)
  python -m retention_sim.run_retention --synthetic

  # 출력 디렉터리 지정
  python -m retention_sim.run_retention --synthetic --out ./my_retention_results
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# careerpt_sim 패키지가 같은 ralph_loop/ 아래 있음
_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

from careerpt_sim.config import DATA_DIR, SIM_HOME, round_dir
from retention_sim.report import generate_report
from retention_sim.simulate import (
    _load_atypical_ids,
    _load_round_scores,
    _synthetic_scores,
    run_simulation,
    save_results,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="CareerPT 12주 retention 시뮬레이션")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--round", type=int, metavar="N",
                       help="실제 ralph_loop 라운드 번호 (예: --round 1)")
    group.add_argument("--synthetic", action="store_true",
                       help="합성 스코어로 시뮬레이션 (실제 세션 데이터 불필요)")

    parser.add_argument("--weeks", type=int, default=12, metavar="N",
                        help="시뮬레이션 주 수 (기본 12)")
    parser.add_argument("--out", type=Path, default=None,
                        help="출력 디렉터리 (기본: ~/.careerpt-sim/retention_results/)")
    parser.add_argument("--seed", type=int, default=42,
                        help="합성 스코어 난수 시드 (기본 42)")
    args = parser.parse_args()

    out_dir: Path = args.out or (SIM_HOME / "retention_results")

    # 1) 스코어 로드
    if args.round is not None:
        rd = round_dir(args.round)
        print(f"[retention_sim] 라운드 {args.round} 결과 로드: {rd}")
        scores = _load_round_scores(rd)
        if not scores:
            print(f"오류: {rd} 에서 유효한 세션 결과를 찾지 못했습니다.")
            print("  → --synthetic 옵션으로 합성 스코어를 사용하거나 ralph_loop를 먼저 실행하세요.")
            sys.exit(1)
        print(f"  {len(scores)}명 페르소나 스코어 로드 완료")
    else:
        personas_jsonl = DATA_DIR / "personas_with_goals.jsonl"
        print(f"[retention_sim] 합성 스코어 생성 (seed={args.seed}): {personas_jsonl}")
        scores = _synthetic_scores(personas_jsonl, seed=args.seed)
        print(f"  {len(scores)}명 페르소나 합성 스코어 생성 완료")

    # 2) 비정형 페르소나 목록
    atypical_ids = _load_atypical_ids(DATA_DIR)
    if atypical_ids:
        print(f"  비정형 페르소나: {sorted(atypical_ids)}")
    else:
        print("  비정형 페르소나 목록 없음 (atypical_personas.txt 미존재)")

    # 3) 시뮬레이션
    print(f"\n[retention_sim] {args.weeks}주 시뮬레이션 실행 중 (3 시나리오) ...")
    results = run_simulation(scores, atypical_ids, n_weeks=args.weeks)

    # 4) 결과 저장
    save_results(results, scores, out_dir, n_weeks=args.weeks)
    print(f"[retention_sim] JSON 결과 저장: {out_dir}")

    # 5) 리포트 생성
    summary_path = out_dir / "summary.json"
    report_path  = out_dir / "retention_report.md"
    generate_report(summary_path, report_path)
    print(f"[retention_sim] 리포트 생성: {report_path}")

    # 6) 터미널 요약 출력
    import json
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    print("\n" + "="*60)
    print("12주 잔존율 요약")
    print("="*60)
    print(f"{'시나리오':<14}  {'전체 평균':>10}  {'비정형 7명':>10}")
    print("-"*40)
    for sc in summary["scenarios"]:
        total = sc["week12_mean_retention"] * 100
        atyp  = sc["week12_atypical_retention"] * 100
        print(f"{sc['scenario']:<14}  {total:>9.1f}%  {atyp:>9.1f}%")
    print("="*60)
    print(f"\n리포트: {report_path}")


if __name__ == "__main__":
    main()
