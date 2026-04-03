// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

const buildDate = new Date().toISOString();

// https://astro.build/config
export default defineConfig({
  site: 'https://recipepricer.com',
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !['/activate/', '/pantry/', '/template/'].some((p) => page.endsWith(p)),
      serialize: (item) => ({ ...item, lastmod: buildDate }),
    }),
  ],
  adapter: cloudflare(),
  output: 'server',
});
