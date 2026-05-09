import { chromium } from 'playwright';

export async function renderHtmlScreenshot(
  html: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html, { waitUntil: 'load' });
    return await page.screenshot({ type: 'png', fullPage: false });
  } finally {
    await browser.close();
  }
}
