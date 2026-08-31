import { expect, test } from '@playwright/test';

import {
  STORAGE_KEY,
  calculate,
  fillPurchase,
  fillThreePurchases,
  fixtureProducts,
  gotoCalculator,
  purchaseRow,
  purchaseSummaryValue,
  purchases,
  resultMetric,
  resultRegion,
  selectProduct,
  targetPriceLiveRegion,
  targetRegion,
} from './test-helpers';

test.describe('calculator fixture flow', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCalculator(page);
  });

  test('completes the required multi-purchase flow and restores only local state', async ({
    page,
  }) => {
    await selectProduct(page, fixtureProducts.full);
    await page.getByRole('checkbox', { name: /30일간 저장/ }).check();
    await fillPurchase(page, 1, purchases.first);

    await expect(purchaseSummaryValue(page, '계산 평단')).toHaveText('12,000원');
    await expect(purchaseSummaryValue(page, '총수량')).toHaveText('10주');
    await expect(purchaseSummaryValue(page, '총매수금액')).toHaveText('120,000원');

    await calculate(page);
    await expect(resultMetric(page, '내 수익률')).toContainText(/[-+]\d/);
    await expect(resultMetric(page, '상품 본전까지')).toContainText(/본전 이상|[-+]\d/);
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toContainText(
      /양의 복리|음의 복리|복리 차이 없음/,
    );

    for (const tradingDays of [1, 5, 20]) {
      const period = page.getByRole('radio', { name: `${tradingDays}거래일` });
      await period.check();
      await expect(period).toBeChecked();
      await expect(targetPriceLiveRegion(page)).toContainText(`${tradingDays}거래일`);
      await expect(targetPriceLiveRegion(page)).toContainText(/약 [\d,]+원/);
    }

    await fillThreePurchases(page);
    await expect(page.getByRole('group', { name: /^매수 \d+$/ })).toHaveCount(3);
    await expect(purchaseSummaryValue(page, '계산 평단')).toHaveText('11,000원');
    await expect(purchaseSummaryValue(page, '총수량')).toHaveText('20주');
    await expect(purchaseSummaryValue(page, '총매수금액')).toHaveText('220,000원');

    await page.getByRole('button', { name: '매수 2 삭제' }).click();
    await expect(page.getByRole('group', { name: /^매수 \d+$/ })).toHaveCount(2);
    await expect(purchaseSummaryValue(page, '계산 평단')).toHaveText('11,000원');
    await expect(purchaseSummaryValue(page, '총수량')).toHaveText('15주');
    await expect(purchaseSummaryValue(page, '총매수금액')).toHaveText('165,000원');

    await calculate(page);
    await expect(resultRegion(page).getByText('손익 상세')).toBeVisible();

    await page.getByRole('button', { name: '가격 직접 입력' }).click();
    await page.getByLabel('직접 입력할 현재가').fill('8000');
    await page.getByRole('button', { name: '현재가 적용' }).click();
    await expect(page.getByText('직접 입력', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '현재가' })).toContainText('공식 종가');
    await calculate(page);
    await expect(resultRegion(page)).toContainText('손익·본전 직접 입력가');

    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .not.toBeNull();

    await page.reload();
    await expect(page.getByTestId('calculator-root')).toHaveAttribute('data-hydrated', 'true', {
      timeout: 15_000,
    });
    await expect(page.getByRole('region', { name: '상품' })).toContainText(fixtureProducts.full);
    await expect(page.getByRole('group', { name: /^매수 \d+$/ })).toHaveCount(2);
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('12,000');
    await expect(purchaseRow(page, 2).getByLabel('매수가')).toHaveValue('9,000');
    await expect(page.getByText('8,000원', { exact: true })).toBeVisible();
    await expect(page.getByText('직접 입력', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '가격 다시 입력' }).click();
    await expect(page.getByLabel('직접 입력할 현재가')).toHaveValue('8,000');
    await page.getByRole('button', { name: '취소' }).click();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '전체 지우기' }).click();
    await expect(page.getByRole('group', { name: /^매수 \d+$/ })).toHaveCount(1);
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('2026-08-17');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
    await expect(resultRegion(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '본전 계산하기' })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: /30일간 저장/ })).not.toBeChecked();

    const storedAfterReset = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      STORAGE_KEY,
    );
    expect(storedAfterReset).toBeNull();
  });

  test('keeps financial inputs out of persistent storage until the user opts in', async ({
    page,
  }) => {
    await fillPurchase(page, 1, purchases.first);
    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .toBeNull();

    await page.getByRole('checkbox', { name: /30일간 저장/ }).check();
    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .not.toBeNull();

    await page.getByRole('checkbox', { name: /30일간 저장/ }).uncheck();
    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .toBeNull();
  });

  test('distinguishes inverse, stale, and partial-analysis fixture states', async ({ page }) => {
    await selectProduct(page, fixtureProducts.inverse);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(page.getByText('-2X', { exact: true })).toBeVisible();
    await expect(targetRegion(page)).toContainText('본주 환산 참고');
    await expect(targetPriceLiveRegion(page)).toContainText(/약 [\d,]+원|분석 불가/);
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toContainText(
      '본주 종가 기준 비교',
    );

    await selectProduct(page, fixtureProducts.stale);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(
      page.getByRole('status').filter({ hasText: '2026-08-20 종가 기준' }),
    ).toBeVisible();

    await selectProduct(page, fixtureProducts.actualOnly);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(targetRegion(page)).toHaveCount(0);
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toHaveCount(0);
    await expect(resultRegion(page)).toContainText(
      '기초자산 분석을 지원하지 않아 실제 손익과 상품 본전 조건만 계산했습니다.',
    );
  });

  test('shows stock target prices and both favorable and unfavorable compound effects', async ({
    page,
  }) => {
    await selectProduct(page, fixtureProducts.full);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(resultRegion(page)).toContainText('2026.08.25 종가');
    await expect(
      targetRegion(page).getByRole('heading', { name: /본전까지 필요한/ }),
    ).toBeVisible();
    await expect(targetPriceLiveRegion(page)).toContainText(/약 [\d,]+원/);
    await expect(targetPriceLiveRegion(page)).toHaveAttribute('aria-live', 'polite');
    await expect(targetPriceLiveRegion(page)).toHaveAttribute('aria-atomic', 'true');
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toContainText(
      /음의 복리.*불리/s,
    );

    for (const tradingDays of [1, 5, 20]) {
      await page.getByRole('radio', { name: `${tradingDays}거래일` }).check();
      await expect(targetPriceLiveRegion(page)).toContainText(`${tradingDays}거래일`);
      await expect(targetPriceLiveRegion(page)).toContainText(/약 [\d,]+원/);
    }

    await selectProduct(page, fixtureProducts.positive);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toContainText(
      /양의 복리.*2,400원 유리/s,
    );

    await selectProduct(page, fixtureProducts.inverse);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(targetRegion(page)).toContainText('본주 환산 참고');
    await expect(targetPriceLiveRegion(page)).toContainText(/약 [\d,]+원/);
    await expect(resultRegion(page).getByRole('region', { name: '복리효과' })).toContainText(
      /양의 복리|음의 복리|복리 차이 없음/,
    );
  });

  test('invalidates stale results when a new purchase row is added', async ({ page }) => {
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(resultRegion(page)).toBeVisible();

    await page.getByRole('button', { name: '매수내역 추가' }).click();

    await expect(resultRegion(page)).toHaveCount(0);
    await expect(purchaseRow(page, 2).getByLabel('매수일')).toBeFocused();
  });

  test('requires confirmation and clears incompatible inputs when changing products', async ({
    page,
  }) => {
    await fillPurchase(page, 1, purchases.first);
    const search = page.getByRole('combobox', { name: '상품 검색 및 선택' });
    await search.fill(fixtureProducts.inverse);
    const option = page.getByRole('option').filter({ hasText: fixtureProducts.inverse });

    page.once('dialog', (dialog) => dialog.dismiss());
    await option.click();
    await expect(page.getByRole('region', { name: '상품' })).toContainText(fixtureProducts.full);
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('12,000');

    page.once('dialog', (dialog) => dialog.accept());
    await option.click();
    await expect(page.getByRole('region', { name: '상품' })).toContainText(fixtureProducts.inverse);
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('2026-08-17');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
  });

  test('submits with Enter and focuses the first missing field after an incomplete attempt', async ({
    page,
  }) => {
    const calculateButton = page.getByRole('button', { name: '본전 계산하기' });
    await calculateButton.click();
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toBeFocused();
    await expect(purchaseRow(page, 1).getByText('매수가를 입력해 주세요.')).toBeVisible();

    await fillPurchase(page, 1, purchases.first);
    await purchaseRow(page, 1).getByLabel('수량').press('Enter');
    await expect(resultRegion(page)).toBeVisible();
    await expect(resultRegion(page)).toBeFocused();
  });

  test('blocks future dates, non-trading days, zero prices, and zero quantities', async ({
    page,
  }) => {
    const row = purchaseRow(page, 1);
    const calculateButton = page.getByRole('button', { name: '본전 계산하기' });

    await row.getByLabel('매수일').fill('2999-12-31');
    await row.getByLabel('매수가').fill('12000');
    await row.getByLabel('수량').fill('10');
    await expect(row.getByRole('alert')).toHaveText('미래 날짜는 입력할 수 없습니다.');
    await expect(calculateButton).toBeEnabled();

    await row.getByLabel('매수일').fill('2026-08-23');
    await expect(row.getByRole('alert')).toHaveText('이 날짜의 공식 상품 가격이 없습니다.');
    await expect(calculateButton).toBeEnabled();

    await row.getByLabel('매수일').fill('2026-08-17');
    await row.getByLabel('매수가').fill('0');
    await row.getByLabel('수량').fill('0');
    await expect(row.getByRole('alert')).toHaveCount(2);
    await expect(row.getByText('매수가는 1원 이상 정수로 입력해 주세요.')).toBeVisible();
    await expect(row.getByText('수량은 1주 이상 정수로 입력해 주세요.')).toBeVisible();
    await expect(calculateButton).toBeEnabled();

    await expect(page.getByRole('button', { name: '매수 1 삭제' })).toHaveCount(0);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '전체 지우기' }).click();
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('2026-08-17');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
  });
});
