import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrengthsPage from '../page';

// next/navigation mock
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

// supabase mock — 로그인 상태 (이메일 인증 완료)
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      single: jest.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

describe('Strengths 선택 로직', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSearchParams = new URLSearchParams();
    localStorage.clear();
  });

  it('칩 클릭 시 선택 목록에 추가된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);

    // '성취' 칩 클릭
    const chip = await screen.findByRole('button', { name: '성취' });
    await user.click(chip);

    // 푸터에 "성취 선택 해제" 버튼이 나타남
    expect(screen.getByRole('button', { name: '성취 선택 해제' })).toBeInTheDocument();
  });

  it('이미 선택된 칩을 푸터에서 클릭하면 선택 목록에서 제거된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);

    // 성취 추가
    const chip = await screen.findByRole('button', { name: '성취' });
    await user.click(chip);

    // 푸터의 "성취 선택 해제" 클릭 → 제거
    const deselectBtn = screen.getByRole('button', { name: '성취 선택 해제' });
    await user.click(deselectBtn);

    expect(screen.queryByRole('button', { name: '성취 선택 해제' })).not.toBeInTheDocument();
  });

  it('5개 선택된 상태에서 추가 칩 클릭해도 5개를 초과하지 않는다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);

    // 5개 선택: 성취, 정리, 신념, 공정성, 심사숙고
    for (const name of ['성취', '정리', '신념', '공정성', '심사숙고']) {
      const chip = await screen.findByRole('button', { name });
      await user.click(chip);
    }

    // 6번째 칩(체계)은 비활성화됨
    const sixthChip = screen.getByRole('button', { name: '체계' });
    expect(sixthChip).toBeDisabled();
  });

  it('선택 수가 5개 미만일 때 제출 버튼이 비활성화된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);

    // 4개만 선택
    for (const name of ['성취', '정리', '신념', '공정성']) {
      const chip = await screen.findByRole('button', { name });
      await user.click(chip);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /다음으로/ })).toBeDisabled();
    });
  });

  it('선택 수가 정확히 5개일 때 제출 버튼이 활성화된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);

    for (const name of ['성취', '정리', '신념', '공정성', '심사숙고']) {
      const chip = await screen.findByRole('button', { name });
      await user.click(chip);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /다음으로/ })).not.toBeDisabled();
    });
  });

  it('아무것도 선택하지 않으면 푸터 플레이스홀더가 표시된다', async () => {
    render(<StrengthsPage />);
    expect(await screen.findByText('강점을 선택하면 여기에 표시돼요')).toBeInTheDocument();
  });

  it('초기 카운터가 "0 / 5"로 표시된다', async () => {
    render(<StrengthsPage />);
    expect(await screen.findByText('0 / 5')).toBeInTheDocument();
  });

  it('선택 전 칩에 aria-pressed="false"가 설정된다', async () => {
    render(<StrengthsPage />);
    const chip = await screen.findByRole('button', { name: '성취' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('칩 클릭 후 aria-pressed가 "true"로 바뀐다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);
    const chip = await screen.findByRole('button', { name: '성취' });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('칩 선택 후 카운터가 "1 / 5"로 업데이트된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);
    const chip = await screen.findByRole('button', { name: '성취' });
    await user.click(chip);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('칩 선택 후 푸터 플레이스홀더가 사라진다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);
    expect(await screen.findByText('강점을 선택하면 여기에 표시돼요')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: '성취' });
    await user.click(chip);
    expect(screen.queryByText('강점을 선택하면 여기에 표시돼요')).not.toBeInTheDocument();
  });

  it('5개 모두 선택하면 카운터가 "5 / 5"로 표시된다', async () => {
    const user = userEvent.setup();
    render(<StrengthsPage />);
    for (const name of ['성취', '정리', '신념', '공정성', '심사숙고']) {
      const chip = await screen.findByRole('button', { name });
      await user.click(chip);
    }
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
  });

  it('?from=profile 진입 시 CTA 버튼 텍스트가 "강점 수정 저장"이다', async () => {
    mockSearchParams = new URLSearchParams('from=profile');
    render(<StrengthsPage />);
    // 5개 선택해야 버튼 활성화 + 텍스트 표시
    for (const name of ['성취', '정리', '신념', '공정성', '심사숙고']) {
      const chip = await screen.findByRole('button', { name });
      await chip.click();
    }
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '강점 수정 저장' })).toBeInTheDocument();
    });
  });

  it('미인증 상태이면 /login으로 replace 이동한다', async () => {
    const { supabase } = await import('@/lib/supabase/client');
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({ data: { user: null } });
    render(<StrengthsPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
