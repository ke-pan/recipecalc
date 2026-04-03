// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://recipepricer.com',
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !['/activate/', '/pantry/', '/template/'].some((p) => page.endsWith(p)),
    }),
  ],
  adapter: cloudflare(),
  output: 'server',
});
