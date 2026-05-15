'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const INTERVIEW_CARDS = [
  {
    icon: '💼',
    title: '현재 상황 파악',
    desc: '지금 직장 생활에서 만족스러운 점과 불만족스러운 점을 함께 돌아봐요.',
  },
  {
    icon: '🎯',
    title: '미래 방향 탐색',
    desc: '5년 후 어떤 모습이고 싶은지, 어떤 일을 하고 싶은지 이야기해주세요.',
  },
  {
    icon: '🔥',
    title: '동기·가치관 발견',
    desc: '무엇이 나를 움직이게 하는지, 어떤 환경에서 최고의 나를 발휘하는지 찾아봐요.',
  },
  {
    icon: '📊',
    title: '커리어 방향 추천',
    desc: '강점 + 답변을 종합해 5가지 방향을 제안해드려요.',
    descHighlight: '5가지 방향',
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
      <div className="w-[390px] min-h-[100dvh] bg-[var(--surface)] flex flex-col relative overflow-x-hidden shadow-[0_0_40px_rgba(0,0,0,0.18)]">
        {/* Top Bar */}
        <div className="flex items-center px-4 py-[14px] border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-transparent border-none text-[22px] cursor-pointer w-9 h-9 flex items-center justify-center text-[var(--text-primary)] font-inherit"
            aria-label="뒤로가기"
          >
            ←
          </button>
          <span className="flex-1 text-center text-[15px] font-bold text-[var(--text-primary)]">
            커리어 인터뷰
          </span>
          <div className="w-9" />
        </div>

        {/* Progress */}
        <div className="px-[22px] pt-4 pb-2">
          <div className="text-[11px] font-bold text-[var(--text-muted)] tracking-[0.06em] mb-2">
            4 / 5 단계
          </div>
          <div className="h-[6px] bg-[var(--border)] rounded-[var(--radius-full)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-[var(--radius-full)] transition-[width] duration-[400ms]"
              style={{ width: '80%' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-[22px] pb-4">
          {/* Hero */}
          <div className="flex flex-col items-center text-center px-[6px] pt-7">
            <div className="text-[72px] mb-6 leading-none">🗺️</div>
            <div className="text-xs font-bold text-[var(--accent)] tracking-[0.08em] mb-2">
              STEP 4
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
              ⏱ 약 8~12분 소요
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
            💡 <strong className="font-bold">강점 분석 결과(Top 5)</strong>를 참고하여 질문이 구성돼요.
            <br />
            📝 정답이 없는 질문이 많아요. 솔직하게 답해주세요.
          </div>

          <div className="h-2" />
        </div>

        {/* Bottom Bar */}
        <div className="px-[22px] pt-[14px] pb-[22px] bg-[var(--surface)] border-t border-[var(--border)]">
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
