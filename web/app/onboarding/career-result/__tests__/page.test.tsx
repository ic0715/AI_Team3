import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompetencyCard } from '../page';

// next/navigation mock
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// supabase mock
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

// useOnboardingGuard mock
jest.mock('@/lib/hooks/useOnboardingGuard', () => ({
  useOnboardingGuard: () => ({ ready: true }),
}));

const mockSlot = {
  slot: 1,
  competencyId: 'ideation',
  goalTitle: '발상력 키우기',
  domain: 'strategic' as const,
  badge: 'strength_match' as const,
  fitLabel: '강점 연계 높음' as const,
  tags: ['창의', '혁신'],
  emoji: '💡',
  personalizedText: '당신의 강점과 잘 어울립니다.',
};

describe('CompetencyCard', () => {
  it('selected=false일 때 aria-checked="false"가 설정된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
  });

  it('selected=true일 때 aria-checked="true"가 설정된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={true} onClick={jest.fn()} />);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  });

  it('카드 클릭 시 onClick 핸들러가 정확히 1회 호출된다', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={handleClick} />);
    await user.click(screen.getByRole('radio'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('role="radio" 속성이 존재한다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByRole('radio')).toBeInTheDocument();
  });

  it('aria-label에 goalTitle과 fitLabel이 포함된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    const card = screen.getByRole('radio');
    expect(card).toHaveAttribute('aria-label', expect.stringContaining(mockSlot.goalTitle));
    expect(card).toHaveAttribute('aria-label', expect.stringContaining(mockSlot.fitLabel));
  });

  it('fitLabel 텍스트가 badge로 렌더링된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByText(mockSlot.fitLabel)).toBeInTheDocument();
  });

  it('slot.goalTitle 텍스트가 카드 본문에 렌더링된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByText(/발상력 키우기/)).toBeInTheDocument();
  });

  it('slot.personalizedText가 카드 본문에 렌더링된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByText(mockSlot.personalizedText)).toBeInTheDocument();
  });

  it('slot.tags 배열의 각 태그가 렌더링된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByText('창의')).toBeInTheDocument();
    expect(screen.getByText('혁신')).toBeInTheDocument();
  });

  it('연속 2번 클릭 시 onClick이 2회 호출된다', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={handleClick} />);
    await user.click(screen.getByRole('radio'));
    await user.click(screen.getByRole('radio'));
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('selected prop이 false→true로 바뀌면 aria-checked가 업데이트된다', () => {
    const { rerender } = render(
      <CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />
    );
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
    rerender(<CompetencyCard slot={mockSlot} selected={true} onClick={jest.fn()} />);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  });

  it('tags가 빈 배열이어도 오류 없이 렌더링된다', () => {
    const emptyTagsSlot = { ...mockSlot, tags: [] };
    expect(() =>
      render(<CompetencyCard slot={emptyTagsSlot} selected={false} onClick={jest.fn()} />)
    ).not.toThrow();
  });

  it('slot 번호가 카드에 렌더링된다', () => {
    render(<CompetencyCard slot={mockSlot} selected={false} onClick={jest.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
