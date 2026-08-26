import {
  ProductMasterEntrySchema,
  ProductSchema,
  type Product,
  type ProductMasterEntry,
} from './schemas';

const COMMON_EVIDENCE =
  'https://www.samsungpop.com/ux/kor/customer/notice/notice/noticeViewContent.do?MenuSeqNo=23968';
const VERIFIED_AT = '2026-08-26';
const LISTED_DATE = '2026-05-27';

type MasterSeed = Omit<
  ProductMasterEntry,
  'active' | 'analysisCapability' | 'listedDate' | 'verification'
> & {
  evidenceUrl?: string;
  sourceName?: string;
};

function verifiedActualOnly(seed: MasterSeed): ProductMasterEntry {
  const {
    evidenceUrl = COMMON_EVIDENCE,
    sourceName = '공식 증권사 신규상장 안내',
    ...product
  } = seed;
  return ProductMasterEntrySchema.parse({
    ...product,
    listedDate: LISTED_DATE,
    analysisCapability: 'actual-only',
    active: true,
    verification: {
      status: 'verified',
      verifiedAt: VERIFIED_AT,
      sourceName,
      evidenceUrl,
      liveUnderlyingSeriesVerified: false,
    },
  });
}

const samsungSpotIndex = 'KRX 삼성전자 레버리지 지수';
const samsungFuturesIndex = 'KRX 삼성전자 선물 레버리지 지수';
const hynixSpotIndex = 'KRX SK하이닉스 레버리지 지수';
const hynixFuturesIndex = 'KRX SK하이닉스 선물 레버리지 지수';

export const PRODUCT_MASTER: readonly ProductMasterEntry[] = [
  verifiedActualOnly({
    code: '0198B0',
    name: '1Q 삼성전자선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    underlyingId: samsungFuturesIndex,
    underlyingName: samsungFuturesIndex,
    underlyingType: 'futures-index',
  }),
  verifiedActualOnly({
    code: '0194N0',
    name: 'KIWOOM 삼성전자선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    underlyingId: samsungFuturesIndex,
    underlyingName: samsungFuturesIndex,
    underlyingType: 'futures-index',
  }),
  ...[
    '0193W0:KODEX 삼성전자단일종목레버리지',
    '0195R0:TIGER 삼성전자단일종목레버리지',
    '0194M0:ACE 삼성전자단일종목레버리지',
    '0192M0:RISE 삼성전자단일종목레버리지',
    '0193K0:PLUS 삼성전자단일종목레버리지',
  ].map((entry) => {
    const [code, name] = entry.split(':') as [string, string];
    return verifiedActualOnly({
      code,
      name,
      productType: 'ETF',
      leverage: 2,
      underlyingId: samsungSpotIndex,
      underlyingName: samsungSpotIndex,
      underlyingType: 'spot-index',
    });
  }),
  verifiedActualOnly({
    code: '520100',
    name: '미래에셋 레버리지 삼성전자 단일종목 ETN',
    productType: 'ETN',
    leverage: 2,
    underlyingId: 'KRX 삼성전자 TR 레버리지 지수',
    underlyingName: 'KRX 삼성전자 TR 레버리지 지수',
    underlyingType: 'spot-index',
    evidenceUrl:
      'https://kind.krx.co.kr/disclosure/etnisudetail.do?method=searchEtnIsuSummary&strIsuSrtCd=Q520100',
    sourceName: 'KRX KIND 상품개요',
  }),
  verifiedActualOnly({
    code: '0193L0',
    name: 'PLUS 삼성전자선물단일종목인버스2X',
    productType: 'ETF',
    leverage: -2,
    underlyingId: 'KRX 삼성전자 선물 인버스 -2X 지수',
    underlyingName: 'KRX 삼성전자 선물 인버스 -2X 지수',
    underlyingType: 'futures-index',
    evidenceUrl:
      'https://kind.krx.co.kr/disclosure/etfisudetail.do?method=searchEtfIsuSummary&strIsurCd=0193L',
    sourceName: 'KRX KIND 상품개요',
  }),
  verifiedActualOnly({
    code: '0194R0',
    name: 'KIWOOM SK하이닉스선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    underlyingId: hynixFuturesIndex,
    underlyingName: hynixFuturesIndex,
    underlyingType: 'futures-index',
  }),
  verifiedActualOnly({
    code: '0198D0',
    name: '1Q SK하이닉스선물단일종목레버리지',
    productType: 'ETF',
    leverage: 2,
    underlyingId: hynixFuturesIndex,
    underlyingName: hynixFuturesIndex,
    underlyingType: 'futures-index',
  }),
  ...[
    '0193T0:KODEX SK하이닉스단일종목레버리지',
    '0195S0:TIGER SK하이닉스단일종목레버리지',
    '0197W0:SOL SK하이닉스단일종목레버리지',
    '0194T0:ACE SK하이닉스단일종목레버리지',
    '0192L0:RISE SK하이닉스단일종목레버리지',
  ].map((entry) => {
    const [code, name] = entry.split(':') as [string, string];
    return verifiedActualOnly({
      code,
      name,
      productType: 'ETF',
      leverage: 2,
      underlyingId: hynixSpotIndex,
      underlyingName: hynixSpotIndex,
      underlyingType: 'spot-index',
    });
  }),
  verifiedActualOnly({
    code: '520101',
    name: '미래에셋 레버리지 SK하이닉스 단일종목ETN',
    productType: 'ETN',
    leverage: 2,
    underlyingId: 'KRX SK하이닉스 TR 레버리지 지수',
    underlyingName: 'KRX SK하이닉스 TR 레버리지 지수',
    underlyingType: 'spot-index',
    evidenceUrl: 'https://kind.krx.co.kr/external/2026/05/22/000553/20260522001367/68342.htm',
    sourceName: 'KRX KIND 신규상장 공시',
  }),
  verifiedActualOnly({
    code: '0197X0',
    name: 'SOL SK하이닉스선물단일종목인버스2X',
    productType: 'ETF',
    leverage: -2,
    underlyingId: 'KRX SK하이닉스 선물 인버스 -2X 지수',
    underlyingName: 'KRX SK하이닉스 선물 인버스 -2X 지수',
    underlyingType: 'futures-index',
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
    listedDate: entry.listedDate,
    analysisCapability: entry.analysisCapability,
    active: entry.active,
  });
}

export function getVerifiedProduct(code: string): ProductMasterEntry | undefined {
  return PRODUCT_MASTER.find((product) => product.code === code);
}
