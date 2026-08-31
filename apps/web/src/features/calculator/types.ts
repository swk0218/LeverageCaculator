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

export interface SaleDraft {
  id: string;
  date: string;
  price: string;
  quantity: string;
}

export interface SaleDraftErrors {
  date?: string;
  price?: string;
  quantity?: string;
}

export interface StoredCalculatorState {
  version: 2;
  persistInputs: true;
  savedAt: number;
  expiresAt: number;
  productCode: string;
  purchases: PurchaseDraft[];
  sales?: SaleDraft[];
  manualCurrentPrice: string | null;
}
