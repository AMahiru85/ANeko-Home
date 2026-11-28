// @ts-check
import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL,
  integrations: [vue()],
  devToolbar: { enabled: false },
});
