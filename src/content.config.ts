import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    author: z.string(),
    tags: z.array(z.string()).min(1),
    summary: z.string(),
    pinned: z.boolean().default(false)
  })
});

export const collections = { posts };
