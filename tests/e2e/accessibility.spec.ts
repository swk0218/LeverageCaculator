import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  fillPurchase,
  fixtureProducts,
  gotoCalculator,
  purchaseRow,
  purchases,
  resultRegion,
} from './test-helpers';

interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
}

const require = createRequire(import.meta.url);
const axeScriptPath = require.resolve('axe-core/axe.min.js', {
  paths: [resolve(process.cwd(), 'apps/web')],
});

async function seriousAxeViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axeScriptPath });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: Record<string, unknown>,
          ) => Promise<{ violations: AxeViolation[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
    return result.violations;
  });

  return violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      ({ id, help, nodes }) =>
        `${id}: ${help}\n${nodes.map(({ target }) => `  - ${target.join(' ')}`).join('\n')}`,
    )
    .join('\n');
}

async function tabThroughNativeControl(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

test.describe('keyboard and accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoCalculator(page);
  });

  test('has no serious axe violations on the initial and calculated states @a11y', async ({
    page,
  }) => {
    const initialViolations = await seriousAxeViolations(page);
    expect(initialViolations, formatViolations(initialViolations)).toEqual([]);

    await fillPurchase(page, 1, purchases.first);
    await page.getByRole('button', { name: '계산하기' }).click();
    await expect(resultRegion(page)).toBeVisible();

    const resultViolations = await seriousAxeViolations(page);
    expect(resultViolations, formatViolations(resultViolations)).toEqual([]);
  });

  test('completes calculation through the logical keyboard order @a11y', async ({ page }) => {
    const search = page.getByRole('combobox', { name: '상품 검색 및 선택' });
    await search.focus();
    await search.fill(fixtureProducts.full);
    const matchingOption = page.getByRole('option').filter({ hasText: fixtureProducts.full });
    await expect(matchingOption).toBeVisible();
    await page.keyboard.press('ArrowDown');
    const optionId = await matchingOption.getAttribute('id');
    expect(optionId).not.toBeNull();
    await expect(search).toHaveAttribute('aria-activedescendant', optionId ?? '');
    await expect(search).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: '상품' })).toContainText(fixtureProducts.full);
    await expect(search).toBeFocused();

    const row = purchaseRow(page, 1);
    await page.keyboard.press('Tab');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox', { name: '상품 검색 결과' })).toHaveCount(0);
    await expect(row.getByLabel('매수일')).toBeFocused();
    await row.getByLabel('매수일').fill(purchases.first.date);

    const removeButton = page.getByRole('button', { name: '매수 1 삭제' });
    await tabThroughNativeControl(page, removeButton);
    await expect(removeButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(row.getByLabel('매수가')).toBeFocused();
    await row.getByLabel('매수가').fill(purchases.first.price);
    await page.keyboard.press('Tab');
    await expect(row.getByLabel('수량')).toBeFocused();
    await row.getByLabel('수량').fill(purchases.first.quantity);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '추가 매수' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '현재가 수정' })).toBeFocused();
    await page.keyboard.press('Tab');

    const calculateButton = page.getByRole('button', { name: '계산하기' });
    await expect(calculateButton).toBeFocused();
    await expect(calculateButton).toBeEnabled();
    expect(await calculateButton.evaluate((element) => element.matches(':focus-visible'))).toBe(
      true,
    );
    await page.keyboard.press('Enter');

    await expect(resultRegion(page)).toBeVisible();
    await expect(resultRegion(page)).toBeFocused();
  });
});
