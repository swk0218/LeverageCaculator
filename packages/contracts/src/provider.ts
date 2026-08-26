import { z } from 'zod';

import {
  ISODateSchema,
  PricePointSchema,
  ProductSchema,
  type ISODate,
  type Product,
} from './schemas';

export const MarketPricePointSchema = PricePointSchema.extend({
  open: z.number().finite().positive().optional(),
  high: z.number().finite().positive().optional(),
  low: z.number().finite().positive().optional(),
  volume: z.number().finite().nonnegative().optional(),
}).strict();

export const ProviderAssetSchema = z
  .object({
    id: z.string().min(1),
    symbol: z.string().min(1),
    name: z.string().min(1),
    assetType: z.enum(['ETF', 'ETN', 'stock', 'spot-index', 'futures-index']),
    source: z.enum(['fsc-stock', 'fsc-securities-product', 'fsc-market-index', 'fixture']),
  })
  .strict();

export const ProviderSeriesSchema = z
  .object({
    asset: ProviderAssetSchema,
    prices: z.array(MarketPricePointSchema),
    upstreamTotalCount: z.number().int().nonnegative(),
  })
  .strict();

export const ProviderProductDataSchema = z
  .object({
    product: ProductSchema,
    productSeries: ProviderSeriesSchema,
    underlyingSeries: ProviderSeriesSchema.optional(),
  })
  .strict();

export const DataRangeSchema = z
  .object({ from: ISODateSchema, to: ISODateSchema })
  .strict()
  .refine(({ from, to }) => from <= to, {
    message: 'from은 to보다 늦을 수 없습니다.',
    path: ['to'],
  });

export interface MarketDataProvider {
  readonly mode: 'fixture' | 'live';
  fetchProductData(product: Product, range: DataRange): Promise<ProviderProductData>;
}

export type MarketPricePoint = z.infer<typeof MarketPricePointSchema>;
export type ProviderAsset = z.infer<typeof ProviderAssetSchema>;
export type ProviderSeries = z.infer<typeof ProviderSeriesSchema>;
export type ProviderProductData = z.infer<typeof ProviderProductDataSchema>;
export type DataRange = { from: ISODate; to: ISODate };
