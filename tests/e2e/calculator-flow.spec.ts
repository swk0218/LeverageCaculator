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
} from './test-helpers';

test.describe('calculator fixture flow', () => {
  test.beforeEach(async ({ page }) => {
    await gotoCalculator(page);
  });

  test('completes the required multi-purchase flow and restores only local state', async ({
    page,
  }) => {
    await selectProduct(page, fixtureProducts.full);
    await page.getByRole('checkbox', { name: /이 기기에 입력 저장/ }).check();
    await fillPurchase(page, 1, purchases.first);

    await expect(purchaseSummaryValue(page, '계산 평단')).toHaveText('12,000원');
    await expect(purchaseSummaryValue(page, '총수량')).toHaveText('10주');
    await expect(purchaseSummaryValue(page, '총매수금액')).toHaveText('120,000원');

    await calculate(page);
    await expect(resultMetric(page, '현재 수익률')).toContainText(/[-+]\d/);
    await expect(resultMetric(page, 'ETF 본전까지')).toContainText(/평단 이상|[-+]\d/);
    await expect(resultMetric(page, '복리효과')).toContainText(/분석 불가|[-+]\d/);

    for (const tradingDays of [1, 5, 20]) {
      const period = page.getByRole('radio', { name: `${tradingDays}거래일` });
      await period.check();
      await expect(period).toBeChecked();
      await expect(resultMetric(page, '본주 본전 조건')).toContainText(
        `${tradingDays}거래일 균등 움직임 가정`,
      );
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
    await expect(resultRegion(page).getByText('현재 손익 상세')).toBeVisible();

    await page.getByRole('button', { name: '현재가 수정' }).click();
    await page.getByLabel('직접 입력할 현재가').fill('8000');
    await page.getByRole('button', { name: '현재가 적용' }).click();
    await expect(page.getByText('직접 입력', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '현재가' })).toContainText(
      '공식 상품 종가 시계열 유지',
    );
    await calculate(page);
    await expect(resultRegion(page)).toContainText('직접 입력 현재가');

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
    await page.getByRole('button', { name: '현재가 다시 입력' }).click();
    await expect(page.getByLabel('직접 입력할 현재가')).toHaveValue('8,000');
    await page.getByRole('button', { name: '취소' }).click();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '입력 및 저장값 지우기' }).click();
    await expect(page.getByRole('group', { name: /^매수 \d+$/ })).toHaveCount(1);
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
    await expect(resultRegion(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '계산하기' })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: /이 기기에 입력 저장/ })).not.toBeChecked();

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

    await page.getByRole('checkbox', { name: /이 기기에 입력 저장/ }).check();
    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .not.toBeNull();

    await page.getByRole('checkbox', { name: /이 기기에 입력 저장/ }).uncheck();
    await expect
      .poll(() => page.evaluate((storageKey) => localStorage.getItem(storageKey), STORAGE_KEY))
      .toBeNull();
  });

  test('distinguishes inverse, stale, and partial-analysis fixture states', async ({ page }) => {
    await selectProduct(page, fixtureProducts.inverse);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(page.getByText('-2X', { exact: true })).toBeVisible();
    await expect(resultMetric(page, '본주 본전 조건')).toContainText(/[-+]\d|분석 불가/);

    await selectProduct(page, fixtureProducts.stale);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(resultRegion(page)).toContainText(
      '공식 가격 기준일이 평일 기준 2일 이상 지연되었습니다.',
    );

    await selectProduct(page, fixtureProducts.actualOnly);
    await fillPurchase(page, 1, purchases.first);
    await calculate(page);
    await expect(resultMetric(page, '기초지수 본전 조건')).toHaveCount(0);
    await expect(resultMetric(page, '복리효과')).toHaveCount(0);
    await expect(resultRegion(page)).toContainText(
      '기초지수 매핑이 검증되지 않아 실제 손익과 상품 자체 본전만 제공합니다.',
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
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
  });

  test('submits with Enter and focuses the first missing field after an incomplete attempt', async ({
    page,
  }) => {
    const calculateButton = page.getByRole('button', { name: '계산하기' });
    await calculateButton.click();
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toBeFocused();
    await expect(purchaseRow(page, 1).getByText('매수일을 입력해 주세요.')).toBeVisible();

    await fillPurchase(page, 1, purchases.first);
    await purchaseRow(page, 1).getByLabel('수량').press('Enter');
    await expect(resultRegion(page)).toBeVisible();
    await expect(resultRegion(page)).toBeFocused();
  });

  test('blocks future dates, non-trading days, zero prices, and zero quantities', async ({
    page,
  }) => {
    const row = purchaseRow(page, 1);
    const calculateButton = page.getByRole('button', { name: '계산하기' });

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
    await expect(
      row.getByText('매수가는 안전한 계산 범위의 1원 이상 정수로 입력해 주세요.'),
    ).toBeVisible();
    await expect(
      row.getByText('수량은 안전한 계산 범위의 1주 이상 정수로 입력해 주세요.'),
    ).toBeVisible();
    await expect(calculateButton).toBeEnabled();

    await expect(page.getByRole('button', { name: '매수 1 삭제' })).toHaveCount(0);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '입력 및 저장값 지우기' }).click();
    await expect(purchaseRow(page, 1).getByLabel('매수일')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('매수가')).toHaveValue('');
    await expect(purchaseRow(page, 1).getByLabel('수량')).toHaveValue('');
  });
});
