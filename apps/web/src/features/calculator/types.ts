export interface PurchaseDraft {
  id: string;
  date: string;
  price: string;
  quantity: string;
}

export interface PurchaseDraftErrors {
  date?: string;
  price?: string;
  quantity?: string;
}

export interface StoredCalculatorState {
  version: 1;
  productCode: string;
  purchases: PurchaseDraft[];
  manualCurrentPrice: string | null;
}
