import { expect, type Locator, type Page } from '@playwright/test';

export const STORAGE_KEY = 'yangbok-eumbok:calculator';

export const fixtureProducts = {
  full: 'F2UP01',
  positive: 'FPOS01',
  inverse: 'F2DN01',
  stale: 'FSTL01',
  mismatch: 'FMIS01',
  actualOnly: 'FACT01',
} as const;

export interface PurchaseInput {
  date: string;
  price: string;
  quantity: string;
}

export const purchases = {
  first: { date: '2026-08-17', price: '12000', quantity: '10' },
  second: { date: '2026-08-18', price: '11000', quantity: '5' },
  third: { date: '2026-08-19', price: '9000', quantity: '5' },
} satisfies Record<string, PurchaseInput>;

export async function gotoCalculator(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveTitle(/단일종목 레버리지 계산기/);
  await expect(
    page.getByRole('heading', { level: 1, name: '레버리지로 얼마가 돈복사되고 녹았을까요?' }),
  ).toBeVisible();
  await expect(page.getByTestId('calculator-root')).toHaveAttribute('data-hydrated', 'true', {
    timeout: 15_000,
  });
  await expect(page.getByRole('status').filter({ hasText: '체험용 데이터' })).toBeVisible();
}

export function purchaseRow(page: Page, oneBasedIndex: number): Locator {
  return page.getByRole('group', { name: `매수 ${oneBasedIndex}`, exact: true });
}

export async function selectProduct(page: Page, code: string): Promise<void> {
  const productRegion = page.getByRole('region', { name: '상품' });
  const selectedProduct = productRegion.locator('.selected-product');
  if ((await selectedProduct.textContent())?.includes(code)) return;

  const search = page.getByRole('combobox', { name: '상품 검색 및 선택' });
  await search.fill(code);
  const option = page.getByRole('option').filter({ hasText: code });
  await expect(option).toHaveCount(1);
  const hasPositionInput = await page
    .getByRole('group', { name: /^매수 \d+$/ })
    .locator('input:not([type="date"])')
    .evaluateAll((inputs) => inputs.some((input) => (input as HTMLInputElement).value !== ''));
  if (hasPositionInput) page.once('dialog', (dialog) => dialog.accept());
  await option.click();
  await expect(selectedProduct).toContainText(code);
}

export async function fillPurchase(
  page: Page,
  oneBasedIndex: number,
  input: PurchaseInput,
): Promise<void> {
  const row = purchaseRow(page, oneBasedIndex);
  await row.getByLabel('매수일').fill(input.date);
  await row.getByLabel('매수가').fill(input.price);
  await row.getByLabel('수량').fill(input.quantity);
}

export async function addPurchase(page: Page, input: PurchaseInput): Promise<void> {
  await page.getByRole('button', { name: '매수내역 추가' }).click();
  const count = await page.getByRole('group', { name: /^매수 \d+$/ }).count();
  await fillPurchase(page, count, input);
}

export function purchaseSummaryValue(page: Page, label: string): Locator {
  const summary = page.getByLabel('매수내역 자동 계산');
  return summary
    .locator(':scope > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd');
}

export function resultRegion(page: Page): Locator {
  return page.getByRole('region', { name: '계산 결과' });
}

export function targetRegion(page: Page): Locator {
  return resultRegion(page).getByRole('region', { name: /본전까지 필요한/ });
}

export function targetPriceLiveRegion(page: Page): Locator {
  return targetRegion(page).locator('[aria-live="polite"][aria-atomic="true"]');
}

export function resultMetric(page: Page, label: string): Locator {
  const result = resultRegion(page);
  return result
    .locator('dl')
    .first()
    .locator(':scope > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd');
}

export async function calculate(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: '본전 계산하기' });
  await expect(button).toBeEnabled();
  await button.click();
  const result = resultRegion(page);
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  return result;
}

export async function fillThreePurchases(page: Page): Promise<void> {
  await fillPurchase(page, 1, purchases.first);
  await addPurchase(page, purchases.second);
  await addPurchase(page, purchases.third);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}
