'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

/**
 * MAINTAIN 페이즈 공용 하단 탭바.
 * 홈(11) / 회고(12) / 프로필(14) 3개 탭.
 * 13 AI 코칭, NEW07 비밀번호 변경에는 탭바 없음.
 *
 * 사용 예:
 *   <TabBar active="home" />
 *   <TabBar active="reflect" />
 *   <TabBar active="profile" />
 */

export type TabKey = 'home' | 'reflect' | 'profile';

interface TabConfig {
  key: TabKey;
  href: string;
  icon: string;
  label: string;
}

const TABS: TabConfig[] = [
  { key: 'home',    href: '/home',    icon: '🏠', label: '홈' },
  { key: 'reflect', href: '/reflect', icon: '📝', label: '회고' },
  { key: 'profile', href: '/profile', icon: '👤', label: '프로필' },
];

interface TabBarProps {
  active: TabKey;
}

export function TabBar({ active }: TabBarProps) {
  return (
    <nav style={navStyle} aria-label="주요 탭">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            style={{
              ...itemStyle,
              color: isActive ? 'var(--accent)' : 'var(--ink-mute)',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              aria-hidden="true"
              style={{
                ...iconStyle,
                filter: isActive ? 'none' : 'grayscale(.6) opacity(.55)',
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                ...labelStyle,
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const navStyle: CSSProperties = {
  flexShrink: 0,           // flex column 맨 아래 고정 (항상 보임)
  zIndex: 40,
  background: '#fff',
  borderTop: '1px solid var(--line)',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  paddingBottom: 'env(safe-area-inset-bottom, 0)',
  boxShadow: '0 -2px 12px -8px rgba(17,20,24,.08)',
};

const itemStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '10px 0 12px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3px',
  fontFamily: 'inherit',
  textDecoration: 'none',
  transition: 'color .2s',
};

const iconStyle: CSSProperties = {
  fontSize: '20px',
  lineHeight: 1,
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'filter .2s',
};

const labelStyle: CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.02em',
};
