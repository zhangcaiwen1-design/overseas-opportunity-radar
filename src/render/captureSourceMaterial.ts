import { chromium } from 'playwright';

export async function captureSourceMaterial(
  url: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}
