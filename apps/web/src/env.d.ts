/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_DATA_MODE?: 'fixture' | 'live';
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  readonly PUBLIC_AD_SLOT_RESULT?: string;
  readonly PUBLIC_AD_SLOT_CONTENT?: string;
  readonly PUBLIC_CONSENT_READY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
