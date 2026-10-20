// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://blog.thenightside.xyz',
  integrations: [svelte()],
  // Self-hosted at build time: no third-party font requests at runtime
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [400, 500, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['monospace'],
      optimizedFallbacks: false
    }
  ],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro'
    }
  }
});
