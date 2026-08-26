import { PRODUCT_MASTER } from '@contracts/product-master';
import type { Product, ProductDataBundle } from '@contracts/schemas';

export const AVAILABLE_PRODUCTS: Product[] = PRODUCT_MASTER.filter(({ active }) => active);

export function getLocalProductData(productCode: string): ProductDataBundle | null {
  void productCode;
  return null;
}
