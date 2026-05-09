import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout from '../app/layout';

describe('RootLayout', () => {
  it('renders navigation links for the standalone web app pages', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>content</div>
      </RootLayout>,
    );

    expect(html).toContain('Independent Web App');
    expect(html).toContain('href="/"');
    expect(html).toContain('今日工作台');
    expect(html).toContain('href="/history"');
    expect(html).toContain('历史记录');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('运行设置');
  });
});
