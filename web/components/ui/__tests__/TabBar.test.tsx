import { render, screen } from '@testing-library/react';
import { TabBar } from '../TabBar';

// next/navigation mock (Link 컴포넌트 내부에서 사용)
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

describe('TabBar', () => {
  it('홈, 회고, 프로필 레이블 텍스트가 모두 렌더링된다', () => {
    render(<TabBar active="home" />);
    expect(screen.getByText('홈')).toBeInTheDocument();
    expect(screen.getByText('회고')).toBeInTheDocument();
    expect(screen.getByText('프로필')).toBeInTheDocument();
  });

  it('active="home"일 때 홈 링크에 aria-current="page"가 설정된다', () => {
    render(<TabBar active="home" />);
    expect(screen.getByRole('link', { name: /홈/ })).toHaveAttribute('aria-current', 'page');
  });

  it('active="home"일 때 비활성 탭에는 aria-current 속성이 없다', () => {
    render(<TabBar active="home" />);
    expect(screen.getByRole('link', { name: /회고/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /프로필/ })).not.toHaveAttribute('aria-current');
  });

  it('active="reflect"일 때 회고 링크에 aria-current="page"가 설정된다', () => {
    render(<TabBar active="reflect" />);
    expect(screen.getByRole('link', { name: /회고/ })).toHaveAttribute('aria-current', 'page');
  });

  it('active="profile"일 때 프로필 링크에 aria-current="page"가 설정된다', () => {
    render(<TabBar active="profile" />);
    expect(screen.getByRole('link', { name: /프로필/ })).toHaveAttribute('aria-current', 'page');
  });

  it('각 탭의 href가 /home, /reflect, /profile이다', () => {
    render(<TabBar active="home" />);
    expect(screen.getByRole('link', { name: /홈/ })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: /회고/ })).toHaveAttribute('href', '/reflect');
    expect(screen.getByRole('link', { name: /프로필/ })).toHaveAttribute('href', '/profile');
  });

  it('active="reflect"일 때 홈·프로필 링크에는 aria-current 속성이 없다', () => {
    render(<TabBar active="reflect" />);
    expect(screen.getByRole('link', { name: /홈/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /프로필/ })).not.toHaveAttribute('aria-current');
  });

  it('active="profile"일 때 홈·회고 링크에는 aria-current 속성이 없다', () => {
    render(<TabBar active="profile" />);
    expect(screen.getByRole('link', { name: /홈/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /회고/ })).not.toHaveAttribute('aria-current');
  });

  it('nav 요소에 aria-label="주요 탭"이 설정된다', () => {
    render(<TabBar active="home" />);
    expect(screen.getByRole('navigation', { name: '주요 탭' })).toBeInTheDocument();
  });

  it('링크가 정확히 3개 렌더링된다', () => {
    render(<TabBar active="home" />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('active prop이 home→reflect로 바뀌면 aria-current가 올바르게 이동한다', () => {
    const { rerender } = render(<TabBar active="home" />);
    expect(screen.getByRole('link', { name: /홈/ })).toHaveAttribute('aria-current', 'page');
    rerender(<TabBar active="reflect" />);
    expect(screen.getByRole('link', { name: /홈/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /회고/ })).toHaveAttribute('aria-current', 'page');
  });
});
