import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CareerIntroPage from '../page';

// next/navigation mock
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

// supabase mock — 기본적으로 비로그인 상태 반환
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

describe('CareerIntroPage', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
  });

  it('페이지 타이틀과 STEP 2 배지가 렌더링된다', () => {
    render(<CareerIntroPage />);
    expect(screen.getByText('STEP 2')).toBeInTheDocument();
    expect(screen.getByText(/이제 커리어 방향을/)).toBeInTheDocument();
  });

  it('5개의 인터뷰 안내 카드 제목이 모두 렌더링된다', () => {
    render(<CareerIntroPage />);
    expect(screen.getByText('원하는 시간으로')).toBeInTheDocument();
    expect(screen.getByText('자유로운 대화')).toBeInTheDocument();
    expect(screen.getByText('주제 합의')).toBeInTheDocument();
    expect(screen.getByText('통찰 정리')).toBeInTheDocument();
    expect(screen.getByText('액션 아이템 추천')).toBeInTheDocument();
  });

  it('강점 데이터가 없으면 로딩 메시지를 표시한다', () => {
    render(<CareerIntroPage />);
    expect(screen.getByText('강점 데이터를 불러오는 중...')).toBeInTheDocument();
  });

  it('"인터뷰 시작하기" 버튼 클릭 시 career-interview 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    render(<CareerIntroPage />);
    await user.click(screen.getByRole('button', { name: /인터뷰 시작하기/ }));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/career-interview');
  });

  it('뒤로가기 버튼 클릭 시 router.back()이 호출된다', async () => {
    const user = userEvent.setup();
    render(<CareerIntroPage />);
    await user.click(screen.getByRole('button', { name: '뒤로가기' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
