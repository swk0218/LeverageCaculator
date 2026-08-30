import {
  ProductMasterEntrySchema,
  ProductSchema,
  type Product,
  type ProductMasterEntry,
} from './schemas';

const COMMON_EVIDENCE =
  'https://www.samsungpop.com/ux/kor/customer/notice/notice/noticeViewContent.do?MenuSeqNo=23968';
const CATALOG_VERIFIED_AT = '2026-08-26';
const LIVE_UNDERLYING_SERIES_VERIFIED_AT = '2026-08-31';
const LISTED_DATE = '2026-05-27';

type MasterSeed = Omit<
  ProductMasterEntry,
  'active' | 'analysisCapability' | 'listedDate' | 'verification'
> & {
  evidenceUrl?: string;
  sourceName?: string;
};

function verifiedFull(seed: MasterSeed): ProductMasterEntry {
  const {
    evidenceUrl = COMMON_EVIDENCE,
    sourceName = '공식 증권사 신규상장 안내',
    ...product
  } = seed;
  return ProductMasterEntrySchema.parse({
    ...product,
    listedDate: LISTED_DATE,
    analysisCapability: 'full',
    active: true,
    verification: {
      status: 'verified',
      verifiedAt: CATALOG_VERIFIED_AT,
      sourceName,
      evidenceUrl,
      liveUnderlyingSeriesVerified: true,
      liveUnderlyingSeriesVerifiedAt: LIVE_UNDERLYING_SERIES_VERIFIED_AT,
    },
  });
}

const samsungStock = {
  underlyingId: '005930',
  underlyingName: '삼성전자',
  underlyingType: 'stock' as const,
};
const hynixStock = {
  underlyingId: '000660',
  underlyingName: 'SK하이닉스',
  underlyingType: 'stock' as const,
};
const samsungSpotBaseIndex = {
  baseIndexName: 'KRX 삼성전자 지수(PR)',
  baseIndexType: 'price-return-index' as const,
};
const samsungFuturesBaseIndex = {
  baseIndexName: 'KRX 삼성전자 선물 지수',
  baseIndexType: 'futures-index' as const,
};
const samsungTrBaseIndex = {
  baseIndexName: 'KRX 삼성전자 TR 지수',
  baseIndexType: 'total-return-index' as const,
};
const hynixSpotBaseIndex = {
  baseIndexName: 'KRX SK하이닉스 지수(PR)',
  baseIndexType: 'price-return-index' as const,
};
const hynixFuturesBaseIndex = {
  baseIndexName: 'KRX SK하이닉스 선물 지수',
  baseIndexType: 'futures-index' as const,
};
const hynixTrBaseIndex = {
  baseIndexName: 'KRX SK하이닉스 TR 지수',
  baseIndexType: 'total-return-index' as const,
};

export const PRODUCT_MASTER: readonly ProductMasterEntry[] = [
  verifiedFull({
    code: '0198B0',
    name: '1Q 삼성전자선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    ...samsungStock,
    ...samsungFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
  }),
  verifiedFull({
    code: '0194N0',
    name: 'KIWOOM 삼성전자선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    ...samsungStock,
    ...samsungFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
  }),
  ...[
    '0193W0:KODEX 삼성전자단일종목레버리지',
    '0195R0:TIGER 삼성전자단일종목레버리지',
    '0194M0:ACE 삼성전자단일종목레버리지',
    '0192M0:RISE 삼성전자단일종목레버리지',
    '0193K0:PLUS 삼성전자단일종목레버리지',
  ].map((entry) => {
    const [code, name] = entry.split(':') as [string, string];
    return verifiedFull({
      code,
      name,
      productType: 'ETF',
      leverage: 2,
      ...samsungStock,
      ...samsungSpotBaseIndex,
      analysisBasis: 'underlying-stock',
    });
  }),
  verifiedFull({
    code: '520100',
    name: '미래에셋 레버리지 삼성전자 단일종목 ETN',
    productType: 'ETN',
    leverage: 2,
    ...samsungStock,
    ...samsungTrBaseIndex,
    analysisBasis: 'reference-stock-proxy',
    evidenceUrl:
      'https://kind.krx.co.kr/disclosure/etnisudetail.do?method=searchEtnIsuSummary&strIsuSrtCd=Q520100',
    sourceName: 'KRX KIND 상품개요',
  }),
  verifiedFull({
    code: '0193L0',
    name: 'PLUS 삼성전자선물단일종목인버스2X',
    productType: 'ETF',
    leverage: -2,
    ...samsungStock,
    ...samsungFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
    evidenceUrl:
      'https://kind.krx.co.kr/disclosure/etfisudetail.do?method=searchEtfIsuSummary&strIsurCd=0193L',
    sourceName: 'KRX KIND 상품개요',
  }),
  verifiedFull({
    code: '0194R0',
    name: 'KIWOOM SK하이닉스선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    ...hynixStock,
    ...hynixFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
  }),
  verifiedFull({
    code: '0198D0',
    name: '1Q SK하이닉스선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    ...hynixStock,
    ...hynixFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
  }),
  ...[
    '0193T0:KODEX SK하이닉스단일종목레버리지',
    '0195S0:TIGER SK하이닉스단일종목레버리지',
    '0197W0:SOL SK하이닉스단일종목레버리지',
    '0194T0:ACE SK하이닉스단일종목레버리지',
    '0192L0:RISE SK하이닉스단일종목레버리지',
  ].map((entry) => {
    const [code, name] = entry.split(':') as [string, string];
    return verifiedFull({
      code,
      name,
      productType: 'ETF',
      leverage: 2,
      ...hynixStock,
      ...hynixSpotBaseIndex,
      analysisBasis: 'underlying-stock',
    });
  }),
  verifiedFull({
    code: '520101',
    name: '미래에셋 레버리지 SK하이닉스 단일종목ETN',
    productType: 'ETN',
    leverage: 2,
    ...hynixStock,
    ...hynixTrBaseIndex,
    analysisBasis: 'reference-stock-proxy',
    evidenceUrl: 'https://kind.krx.co.kr/external/2026/05/22/000553/20260522001367/68342.htm',
    sourceName: 'KRX KIND 신규상장 공시',
  }),
  verifiedFull({
    code: '0197X0',
    name: 'SOL SK하이닉스선물단일종목인버스2X',
    productType: 'ETF',
    leverage: -2,
    ...hynixStock,
    ...hynixFuturesBaseIndex,
    analysisBasis: 'reference-stock-proxy',
    evidenceUrl: 'https://www.soletf.co.kr/ko/fund/etf/211114?tabIndex=3',
    sourceName: '신한자산운용 SOL ETF 상품 페이지',
  }),
];

export function toProduct(entry: ProductMasterEntry): Product {
  return ProductSchema.parse({
    code: entry.code,
    name: entry.name,
    productType: entry.productType,
    leverage: entry.leverage,
    underlyingId: entry.underlyingId,
    underlyingName: entry.underlyingName,
    underlyingType: entry.underlyingType,
    ...(entry.analysisBasis === undefined ? {} : { analysisBasis: entry.analysisBasis }),
    ...(entry.baseIndexName === undefined ? {} : { baseIndexName: entry.baseIndexName }),
    ...(entry.baseIndexType === undefined ? {} : { baseIndexType: entry.baseIndexType }),
    listedDate: entry.listedDate,
    analysisCapability: entry.analysisCapability,
    active: entry.active,
  });
}

export function getVerifiedProduct(code: string): ProductMasterEntry | undefined {
  return PRODUCT_MASTER.find((product) => product.code === code);
}
