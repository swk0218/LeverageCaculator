import { expect, test, type Request } from '@playwright/test';

import { calculate, fillPurchase, gotoCalculator, purchases, resultRegion } from './test-helpers';

interface ObservedRequest {
  method: string;
  resourceType: string;
  url: string;
  body: string;
}

test('never sends financial inputs outside the browser', async ({ page }) => {
  await gotoCalculator(page);

  const observed: ObservedRequest[] = [];
  const observeRequest = (request: Request) => {
    observed.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      body: request.postData() ?? '',
    });
  };
  page.on('request', observeRequest);

  const privatePurchase = {
    ...purchases.first,
    price: '987654321',
    quantity: '54321',
  };
  await fillPurchase(page, 1, privatePurchase);
  await page.getByRole('button', { name: '현재가 수정' }).click();
  await page.getByLabel('직접 입력할 현재가').fill('7654321');
  await page.getByRole('button', { name: '현재가 적용' }).click();
  await calculate(page);

  const actualDetail = resultRegion(page).getByRole('region', { name: '현재 손익 상세' });
  await actualDetail.locator('summary').click();
  const pnlText = await actualDetail
    .locator('dl > div')
    .filter({ has: page.getByText('손익금액', { exact: true }) })
    .locator('dd')
    .innerText();
  const pnlDigits = pnlText.replace(/[^0-9-]/g, '');
  const pnlFormatted = pnlText.replace(/원$/u, '');

  await page.getByRole('radio', { name: '1거래일' }).check();
  await page.getByRole('radio', { name: '5거래일' }).check();
  await page.getByRole('radio', { name: '20거래일' }).check();

  page.off('request', observeRequest);

  const requestMaterial = observed
    .map(({ url, body }) => `${decodeURIComponent(url)}\n${body}`)
    .join('\n');
  const sensitiveValues = [
    privatePurchase.date,
    privatePurchase.price,
    '987,654,321',
    privatePurchase.quantity,
    '54,321',
    '7654321',
    '7,654,321',
    pnlDigits,
    pnlFormatted,
  ].filter((value) => value.length > 0);
  const currentUrlMaterial = decodeURIComponent(page.url());

  for (const sensitiveValue of sensitiveValues) {
    expect(requestMaterial).not.toContain(sensitiveValue);
    expect(currentUrlMaterial).not.toContain(sensitiveValue);
  }

  const financialApiRequests = observed.filter(({ resourceType }) =>
    ['fetch', 'xhr', 'beacon'].includes(resourceType),
  );
  expect(financialApiRequests).toEqual([]);
  expect(
    observed.some(({ url }) => /googlesyndication|google-analytics|doubleclick/i.test(url)),
  ).toBe(false);
});
