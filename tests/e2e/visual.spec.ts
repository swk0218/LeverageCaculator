import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  calculate,
  fillPurchase,
  fillThreePurchases,
  fixtureProducts,
  gotoCalculator,
  purchases,
  selectProduct,
} from './test-helpers';

const responsiveViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
] as const;

const stateViewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
] as const;

const visualStylePath = resolve(process.cwd(), 'tests/e2e/visual-screenshot.css');

async function prepareFixturePage(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoCalculator(page);
  await page.evaluate(() => document.fonts.ready);
}

async function expectFullPageSnapshot(page: Page, name: string): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.005,
    scale: 'css',
    stylePath: visualStylePath,
  });
}

for (const viewport of responsiveViewports) {
  test(`initial screen at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await expectFullPageSnapshot(page, `initial-${viewport.width}.png`);
  });
}

for (const viewport of stateViewports) {
  test(`three purchases at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await fillThreePurchases(page);
    await expectFullPageSnapshot(page, `three-purchases-${viewport.width}.png`);
  });

  test(`loss result at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expectFullPageSnapshot(page, `loss-result-${viewport.width}.png`);
  });

  test(`profit result at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await fillPurchase(page, 1, purchases.first);
    await page.getByRole('button', { name: '현재가 수정' }).click();
    await page.getByLabel('직접 입력할 현재가').fill('15000');
    await page.getByRole('button', { name: '현재가 적용' }).click();
    await calculate(page);
    await expectFullPageSnapshot(page, `profit-result-${viewport.width}.png`);
  });

  test(`inverse result at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await selectProduct(page, fixtureProducts.inverse);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expectFullPageSnapshot(page, `inverse-result-${viewport.width}.png`);
  });

  test(`manual current price at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await fillPurchase(page, 1, purchases.first);
    await page.getByRole('button', { name: '현재가 수정' }).click();
    await page.getByLabel('직접 입력할 현재가').fill('8000');
    await page.getByRole('button', { name: '현재가 적용' }).click();
    await calculate(page);
    await expectFullPageSnapshot(page, `manual-price-${viewport.width}.png`);
  });

  test(`stale data at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await selectProduct(page, fixtureProducts.stale);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expectFullPageSnapshot(page, `stale-data-${viewport.width}.png`);
  });

  test(`partial analysis at ${viewport.width}px @visual`, async ({ page }) => {
    await prepareFixturePage(page, viewport);
    await selectProduct(page, fixtureProducts.actualOnly);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expectFullPageSnapshot(page, `partial-analysis-${viewport.width}.png`);
  });
}

test('API error at 390px @visual', async ({ page }) => {
  test.skip(
    process.env.E2E_LIVE_ERROR_STATE !== '1',
    'Run explicitly against a PUBLIC_DATA_MODE=live web server to approve the API error baseline.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/analysis-data**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'E2E_UPSTREAM_UNAVAILABLE', message: '테스트 오류' } }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('가격 데이터를 불러오지 못했습니다.');
  await expectFullPageSnapshot(page, 'api-error-390.png');
});
