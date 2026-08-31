import { expect, test } from '@playwright/test';

import {
  calculate,
  expectNoHorizontalOverflow,
  fillPurchase,
  fillThreePurchases,
  fixtureProducts,
  gotoCalculator,
  purchases,
  selectProduct,
} from './test-helpers';

const requiredViewports = [
  { width: 320, height: 720 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 },
] as const;

for (const viewport of requiredViewports) {
  test(`has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await gotoCalculator(page);
    await expectNoHorizontalOverflow(page);

    await selectProduct(page, fixtureProducts.inverse);
    await fillPurchase(page, 1, purchases.first);
    await expectNoHorizontalOverflow(page);
    await calculate(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('region', { name: '계산 결과' })).toContainText('본주 환산 참고');
  });
}

test('keeps the three-row result and advertising clear of controls at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoCalculator(page);
  await fillThreePurchases(page);
  await calculate(page);
  await expectNoHorizontalOverflow(page);

  for (const controlName of ['매수내역 추가', '본전 계산하기', '전체 지우기']) {
    const control = page.getByRole('button', { name: controlName });
    const box = await control.boundingBox();
    expect(box, `${controlName} control must be rendered`).not.toBeNull();
    expect(box?.height ?? 0, `${controlName} must have a 44px touch target`).toBeGreaterThanOrEqual(
      44,
    );
  }

  const adSlots = page.getByRole('complementary', { name: '광고' });
  const actionButtons = page.getByRole('button', {
    name: /매수내역 추가|본전 계산하기|가격 직접 입력/,
  });
  for (let adIndex = 0; adIndex < (await adSlots.count()); adIndex += 1) {
    const adBox = await adSlots.nth(adIndex).boundingBox();
    if (adBox === null) continue;
    for (let buttonIndex = 0; buttonIndex < (await actionButtons.count()); buttonIndex += 1) {
      const buttonBox = await actionButtons.nth(buttonIndex).boundingBox();
      if (buttonBox === null) continue;
      const overlaps =
        adBox.x < buttonBox.x + buttonBox.width &&
        adBox.x + adBox.width > buttonBox.x &&
        adBox.y < buttonBox.y + buttonBox.height &&
        adBox.y + adBox.height > buttonBox.y;
      expect(overlaps, `advertisement ${adIndex + 1} overlaps a calculator control`).toBe(false);
    }
  }
});

test('keeps the product result list visible above the following sections on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoCalculator(page);

  const search = page.getByRole('combobox', { name: '상품 검색 및 선택' });
  await search.fill(fixtureProducts.full);
  const list = page.getByRole('listbox', { name: '상품 검색 결과' });
  await expect(list).toBeVisible();
  await expect(page.locator('.calculator-frame')).toHaveCSS('overflow', 'visible');

  const listVisibleAtMidpoint = await list.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + Math.min(24, rect.width / 2);
    const y = rect.top + Math.min(120, rect.height - 1);
    return document.elementFromPoint(x, y)?.closest('[role="listbox"]') === element;
  });
  expect(listVisibleAtMidpoint).toBe(true);
});
