// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://focused-noether.example',
  integrations: [svelte()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro'
    }
  }
});
