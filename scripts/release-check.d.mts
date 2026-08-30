export interface PagesStaticProductExpectation {
  readonly underlyingId: '005930' | '000660';
  readonly analysisBasis: 'underlying-stock' | 'reference-stock-proxy';
  readonly baseIndexName: string;
  readonly baseIndexType: 'price-return-index' | 'futures-index' | 'total-return-index';
}

export const PAGES_STATIC_PRODUCT_EXPECTATIONS: Readonly<
  Record<string, PagesStaticProductExpectation>
>;

export function validatePagesStaticProductExport(fileName: string, payload: unknown): string[];
