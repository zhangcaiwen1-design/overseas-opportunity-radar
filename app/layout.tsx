import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

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
              <div>
                <span className="page-kicker">Independent Web App</span>
                <h1 className="app-header__title">Overseas Opportunity Radar</h1>
              </div>
              <nav className="app-nav" aria-label="主导航">
                {navigation.map((item) => (
                  <Link key={item.href} href={item.href} className="app-nav__link">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
