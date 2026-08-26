import { fixtureCatalog, getFixtureProductData } from '@contracts/fixtures';
import type { Product, ProductDataBundle } from '@contracts/schemas';

export const AVAILABLE_PRODUCTS: Product[] = fixtureCatalog.map(({ product }) => product);

export function getLocalProductData(productCode: string): ProductDataBundle | null {
  return getFixtureProductData(productCode) ?? null;
}
