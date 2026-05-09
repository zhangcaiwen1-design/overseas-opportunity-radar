import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SettingsForm } from '../app/settings/SettingsForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('SettingsForm', () => {
  it('renders the cron expression passed from the settings view model', () => {
    const html = renderToStaticMarkup(
      <SettingsForm
        timezone="Asia/Shanghai"
        dailyRunTime="09:00"
        cronExpression="0 1 * * *"
        configs={[]}
        cloudReady={true}
      />,
    );

    expect(html).toContain('当前 cron：0 1 * * *');
  });
});
