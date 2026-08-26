import { z } from 'zod';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(instant.valueOf()) && instant.toISOString().slice(0, 10) === value;
}

export const ISODateSchema = z
  .string()
  .refine(isRealIsoDate, '날짜는 실제 존재하는 YYYY-MM-DD 형식이어야 합니다.');

export const ProductSchema = z
  .object({
    code: z.string().regex(/^[0-9A-Z]{6}$/, '종목코드는 6자리 영문 대문자 또는 숫자여야 합니다.'),
    name: z.string().trim().min(1),
    productType: z.enum(['ETF', 'ETN']),
    leverage: z
      .number()
      .finite()
      .refine((value) => value !== 0, '배수는 0일 수 없습니다.'),
    underlyingId: z.string().trim().min(1),
    underlyingName: z.string().trim().min(1),
    underlyingType: z.enum(['stock', 'spot-index', 'futures-index']),
    listedDate: ISODateSchema,
    analysisCapability: z.enum(['full', 'actual-only']),
    active: z.boolean(),
  })
  .strict();

export const PricePointSchema = z
  .object({
    date: ISODateSchema,
    close: z.number().finite().positive(),
  })
  .strict();

export const PriceSeriesSchema = z.array(PricePointSchema).superRefine((points, context) => {
  let previousDate: string | undefined;
  for (const [index, point] of points.entries()) {
    if (previousDate !== undefined && point.date <= previousDate) {
      context.addIssue({
        code: 'custom',
        message: '시계열은 날짜 오름차순이며 중복 날짜가 없어야 합니다.',
        path: [index, 'date'],
      });
    }
    previousDate = point.date;
  }
});

export const StaleStatusSchema = z
  .object({
    isStale: z.boolean(),
    asOf: ISODateSchema,
    checkedAt: ISODateSchema,
    businessDaysBehind: z.number().int().nonnegative(),
    thresholdBusinessDays: z.literal(2),
  })
  .strict();

export const ProductDataBundleSchema = z
  .object({
    product: ProductSchema,
    productSeries: PriceSeriesSchema,
    underlyingSeries: PriceSeriesSchema,
    latest: z
      .object({
        product: PricePointSchema,
        underlying: PricePointSchema.optional(),
        analysisDate: ISODateSchema.optional(),
      })
      .strict(),
    stale: StaleStatusSchema,
    source: z.enum(['fixture', 'database']),
    fetchedAt: z.iso.datetime({ offset: true }),
    warnings: z.array(z.string()),
  })
  .strict();

export const ProductVerificationSchema = z
  .object({
    status: z.literal('verified'),
    verifiedAt: ISODateSchema,
    sourceName: z.string().min(1),
    evidenceUrl: z
      .url()
      .refine((url) => url.startsWith('https://'), '검증 URL은 HTTPS여야 합니다.'),
    liveUnderlyingSeriesVerified: z.boolean(),
  })
  .strict();

export const ProductMasterEntrySchema = ProductSchema.extend({
  verification: ProductVerificationSchema,
}).strict();

export const AnalysisDataQuerySchema = z
  .object({
    productCode: ProductSchema.shape.code,
    from: ISODateSchema,
  })
  .strict();

export const BackfillQuerySchema = z
  .object({
    from: ISODateSchema,
    to: ISODateSchema,
  })
  .strict()
  .refine(({ from, to }) => from <= to, {
    message: 'from은 to보다 늦을 수 없습니다.',
    path: ['to'],
  });

export const ApiMetaSchema = z
  .object({
    mode: z.enum(['fixture', 'live']),
    generatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ProductsResponseSchema = z
  .object({
    data: z.array(ProductSchema),
    meta: ApiMetaSchema,
  })
  .strict();

export const LatestProductResponseSchema = z
  .object({
    data: z
      .object({
        product: ProductSchema,
        latest: PricePointSchema,
        stale: StaleStatusSchema,
      })
      .strict(),
    meta: ApiMetaSchema,
  })
  .strict();

export const AnalysisDataResponseSchema = z
  .object({ data: ProductDataBundleSchema, meta: ApiMetaSchema })
  .strict();

export const HealthResponseSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    mode: z.enum(['fixture', 'live']),
    database: z.enum(['ok', 'unavailable']),
    latestTradeDate: ISODateSchema.nullable(),
    stale: z.boolean(),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type ISODate = z.infer<typeof ISODateSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type PricePoint = z.infer<typeof PricePointSchema>;
export type ProductDataBundle = z.infer<typeof ProductDataBundleSchema>;
export type StaleStatus = z.infer<typeof StaleStatusSchema>;
export type ProductMasterEntry = z.infer<typeof ProductMasterEntrySchema>;
export type AnalysisDataQuery = z.infer<typeof AnalysisDataQuerySchema>;
export type BackfillQuery = z.infer<typeof BackfillQuerySchema>;
