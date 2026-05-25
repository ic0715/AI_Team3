'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// v2 자유 흐름 4-Phase 안내 (schema v0.9 / 커리어 인터뷰 v2)
const INTERVIEW_CARDS = [
  {
    icon: '⏱',
    title: '원하는 시간으로',
    desc: '인터뷰 시작 시 짧게(15~25분), 보통(30~45분), 길게(50분+) 중에서 선택할 수 있어요.',
  },
  {
    icon: '🗣️',
    title: '자유로운 대화',
    desc: '고정 질문 없이 자연스럽게 흘러가요. 지금 가장 큰 커리어 고민부터 함께 꺼내봐요.',
  },
  {
    icon: '🎯',
    title: '주제 합의',
    desc: '코치와 함께 오늘 다룰 핵심 주제를 정한 다음, 그 자리에 머무르며 깊이 들여다봐요.',
  },
  {
    icon: '💡',
    title: '통찰 정리',
    desc: '강점과 답변을 종합해 다음 단계 5가지 역량 방향을 제안해드려요.',
    descHighlight: '5가지 역량 방향',
  },
  {
    icon: '🎯',
    title: '액션 아이템 추천',
    desc: '역량 목표를 고르면, 바로 시작해볼 수 있는 맞춤 액션을 제안해 드려요.',
  },
];

export default function CareerIntroPage() {
  const router = useRouter();
  const [strengths, setStrengths] = useState<string[]>([]);

  useEffect(() => {
    const fetchStrengths = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('strength_analyses')
        .select('strengths')
        .eq('user_id', user.id)
        .eq('is_latest', true)
        .single();

      if (data?.strengths) {
        const names = (data.strengths as { name_ko: string }[]).map((s) => s.name_ko);
        setStrengths(names);
      }
    };

    fetchStrengths();
  }, []);

  return (
    <div className="min-h-screen flex justify-center items-start bg-[#e8eaee]">
      <div className="w-[390px] min-h-[100dvh] bg-[var(--surface)] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.18)]">

          {/* Top Bar */}
          <div className="flex items-center px-4 py-[10px] border-b border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-transparent border-none text-[22px] cursor-pointer w-11 h-11 flex items-center justify-center text-[var(--text-primary)] font-inherit"
              aria-label="뒤로가기"
            >
              ←
            </button>
            <span className="flex-1 text-center text-[15px] font-bold text-[var(--text-primary)]">
              커리어 인터뷰
            </span>
            <div className="w-11" />
          </div>


          {/* Content */}
          <div className="px-[22px] pb-4">
          {/* Hero */}
          <div className="flex flex-col items-center text-center px-[6px] pt-7">
            <div className="text-[72px] mb-6 leading-none">🗺️</div>
            <div className="text-xs font-bold text-[var(--accent)] tracking-[0.08em] mb-2">
              STEP 2
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] leading-[1.35] mb-3 tracking-[-0.02em]">
              이제 커리어 방향을
              <br />
              찾아볼 차례예요
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-[1.65]">
              강점을 어디에 어떻게 쓸지
              <br />
              함께 정리해요.
            </p>
            <div className="inline-flex items-center gap-[6px] mt-5 px-4 py-2 bg-[var(--accent-light)] rounded-[var(--radius-full)] text-[13px] font-semibold text-[var(--accent)]">
              ⏱ 약 15~50분 (인터뷰 시작 시 선택)
            </div>
          </div>

          {/* 강점 Top 5 컨텍스트 */}
          <div className="bg-[var(--bg)] rounded-[var(--radius-md)] px-4 py-[14px] mt-6">
            <div className="text-xs font-bold text-[var(--text-muted)] tracking-[0.04em] mb-[10px]">
              ⭐ 내 강점 Top 5
            </div>
            <div className="flex flex-wrap gap-[6px] mb-[10px]">
              {strengths.length > 0 ? (
                strengths.map((strength) => (
                  <span
                    key={strength}
                    className="text-xs font-bold px-[10px] py-1 bg-[var(--accent-light)] text-[var(--accent)] rounded-[var(--radius-full)]"
                  >
                    {strength}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-muted)]">강점 데이터를 불러오는 중...</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-secondary)] leading-[1.5]">
              이 강점들을 컨텍스트로 인터뷰가 진행돼요.
            </div>
          </div>

          {/* 인터뷰 안내 카드 */}
          <div className="flex flex-col gap-3 mt-5">
            {INTERVIEW_CARDS.map((card) => (
              <div
                key={card.title}
                className="flex items-start gap-3 bg-[var(--bg)] rounded-[var(--radius-md)] px-4 py-[14px] text-left"
              >
                <div className="text-[22px] flex-shrink-0 mt-px">{card.icon}</div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)] mb-[2px]">
                    {card.title}
                  </div>
                  <div className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
                    {card.descHighlight ? (
                      <>
                        강점 + 답변을 종합해{' '}
                        <strong className="text-[var(--accent)] font-bold">
                          {card.descHighlight}
                        </strong>
                        을 제안해드려요.
                      </>
                    ) : (
                      card.desc
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 안내 메시지 */}
          <div className="mt-5 px-4 py-[14px] bg-[#fef9e7] border border-[#fde68a] rounded-[var(--radius-md)] text-[12.5px] text-[var(--text-primary)] leading-[1.7]">
            💡 <strong className="font-bold">강점 Top 5</strong>가 코치의 컨텍스트가 돼요.
            <br />
            📝 고정 질문 없이 자유롭게 흐름이 흘러가요. 솔직하게 답해주세요.
          </div>

          <div className="h-2" />
        </div>

        {/* Bottom Bar */}
        <div className="sticky bottom-0 px-[22px] pt-[14px] pb-[22px] bg-[var(--surface)] border-t border-[var(--border)] z-20">
          <button
            type="button"
            onClick={() => router.push('/onboarding/career-interview')}
            className="w-full inline-flex items-center justify-center px-5 py-[14px] bg-[var(--accent)] text-white border-none font-bold text-[15px] rounded-[var(--radius-md)] cursor-pointer transition-all duration-150 hover:bg-[var(--accent-dark)]"
          >
            인터뷰 시작하기 →
          </button>
        </div>
      </div>
    </div>
  );
}
