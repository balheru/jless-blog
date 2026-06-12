// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://blog.thenightside.xyz',
  integrations: [svelte()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro'
    }
  }
});
