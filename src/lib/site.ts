import pkg from '../../package.json';

export const SITE = {
  name: 'hacker_noether_blog',
  version: pkg.version,
  description: 'JSON-structured terminal blog with Vim keyboard navigation.',
  author: {
    alias: 'focused_noether',
    git: 'github.com/focused-noether',
    specialty: 'Theoretical Physics & Code Craftsmanship'
  }
};

export interface PostIndexEntry {
  slug: string;
  title: string;
  date: string;
  author: string;
  tags: string[];
  summary: string;
  pinned: boolean;
}

/** Pinned first, then date descending — the canonical post ordering. */
export function sortPosts<T extends { pinned: boolean; date: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export { MONTH_NAMES };

export interface DatesTree {
  pinned: string[];
  recent: string[];
  years: Record<string, Record<string, string>>;
}

/** Build the dates pane data: pinned slugs, 10 newest, year/month counts. */
export function buildDatesTree(posts: PostIndexEntry[]): DatesTree {
  const pinned = posts.filter((p) => p.pinned).map((p) => p.slug);
  const normal = posts
    .filter((p) => !p.pinned)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recent = normal.slice(0, 10).map((p) => p.slug);

  const counts: Record<string, Record<string, number>> = {};
  for (const p of normal) {
    const [year, month] = p.date.split('-');
    counts[year] ??= {};
    counts[year][month] = (counts[year][month] ?? 0) + 1;
  }

  const years: DatesTree['years'] = {};
  for (const year of Object.keys(counts).sort((a, b) => Number(b) - Number(a))) {
    years[year] = {};
    for (const month of Object.keys(counts[year]).sort((a, b) => Number(b) - Number(a))) {
      const n = counts[year][month];
      years[year][MONTH_NAMES[Number(month) - 1]] = `${n} post${n === 1 ? '' : 's'}`;
    }
  }

  return { pinned, recent, years };
}
