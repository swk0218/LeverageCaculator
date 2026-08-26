import react from '@astrojs/react';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const isLiveDataBuild = process.env.PUBLIC_DATA_MODE === 'live';
const calculatorProductData = fileURLToPath(
  new URL(
    `./src/features/calculator/productDataSource.${isLiveDataBuild ? 'live' : 'fixture'}.ts`,
    import.meta.url,
  ),
);
const contractsSource = fileURLToPath(new URL('../../packages/contracts/src', import.meta.url));

export default defineConfig({
  integrations: [react()],
  devToolbar: { enabled: false },
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://yangbokeumbok.example',
  vite: {
    resolve: {
      alias: {
        '@calculator-product-data': calculatorProductData,
        '@contracts': contractsSource,
      },
    },
    ssr: {
      noExternal: ['@astryxdesign/core', '@astryxdesign/theme-neutral'],
    },
  },
});
