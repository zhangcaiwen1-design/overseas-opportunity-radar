import './globals.css';
import Link from 'next/link';
import React, { type ReactNode } from 'react';

const navigation = [
  { href: '/', label: '今日工作台' },
  { href: '/history', label: '历史记录' },
  { href: '/settings', label: '运行设置' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="admin-shell">
          <header className="app-header">
            <div className="app-header__inner">
              <div className="app-header__brand">
                <span className="page-kicker">Independent Web App</span>
                <h1 className="app-header__title">Overseas Opportunity Radar</h1>
                <p className="app-header__summary">Collect, select, publish, and convert from one disciplined operating console.</p>
              </div>
              <div className="app-header__nav-block">
                <span className="app-header__meta">Admin Console</span>
                <nav className="app-nav" aria-label="主导航">
                  {navigation.map((item) => (
                    <Link key={item.href} href={item.href} className="app-nav__link">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
