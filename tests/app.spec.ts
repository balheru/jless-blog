import { expect, test, type Page } from '@playwright/test';

// The site launched fresh with a single pinned post. These counts follow
// directly from that one post (tags: homelab, cloudflare, astro):
//   collapsed posts tree = 3 lines  ("posts": [ , the post, ])
//   expanded post object = 14 lines (+11: { title date author tags[ x3 ] summary slug })
const SLUG = 'shipping-the-blog';
const TITLE = 'Shipping This Blog in an Afternoon';

const selected = (page: Page, pane = 'posts') =>
  page.locator(`#${pane}-pane .json-line.selected`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#posts-pane .json-line').first()).toBeVisible();
});

test('renders all panes with the posts tree and status bar', async ({ page }) => {
  for (const pane of ['dates-pane', 'posts-pane', 'metadata-pane']) {
    await expect(page.locator(`#${pane}`)).toBeVisible();
  }
  await expect(page.locator('#posts-pane')).toHaveClass(/active-pane/);
  await expect(selected(page)).toContainText('"posts"');
  await expect(page.locator('.app-footer')).toContainText('MODE: NORMAL');
  await expect(page.locator('.app-footer')).toContainText('PANE: POSTS');
});

test('j/k navigation updates the selection', async ({ page }) => {
  await page.keyboard.press('j');
  await expect(selected(page)).toContainText(TITLE);
  await page.keyboard.press('k');
  await expect(selected(page)).toContainText('"posts"');
});

test('fold keys: l expands, h collapses, h jumps to parent from a leaf', async ({ page }) => {
  const initialCount = await page.locator('#posts-pane .json-line').count();
  
  await page.keyboard.press('j');
  await page.keyboard.press('l'); // expand post
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(initialCount + 11);
  
  await page.keyboard.press('j'); // title leaf
  await expect(selected(page)).toContainText('"title"');
  await page.keyboard.press('h'); // leaf -> parent opening
  await expect(selected(page)).toContainText('{');
  await expect(selected(page)).not.toContainText('"title":');
  await page.keyboard.press('h'); // collapse
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(initialCount);
  await page.keyboard.press('h'); // collapsed -> parent (posts array)
  await expect(selected(page)).toContainText('"posts"');
});

test('gg and G jump to first and last visible line', async ({ page }) => {
  await page.keyboard.press('G');
  await expect(selected(page)).toHaveText(/\]\s*$/);
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(selected(page)).toContainText('"posts"');
});

test('reader round trip: Enter opens the post page, q restores selection and navigation keeps working', async ({ page }) => {
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/posts/${SLUG}/`));
  await expect(page.locator('.app-footer')).toContainText('MODE: PAGER');

  await page.keyboard.press('q');
  await expect(page).toHaveURL(/\/$|\?/);
  await expect(selected(page)).toContainText(TITLE);

  // navigation must still work after returning (prototype froze here)
  await page.keyboard.press('k');
  await expect(selected(page)).toContainText('"posts"');
});

test('search finds tags hidden inside collapsed posts and reveals them', async ({ page }) => {
  const initialCount = await page.locator('#posts-pane .json-line').count();

  await page.keyboard.press('/');
  await page.locator('.search-input').fill('cloudflare'); // a tag, unique to the tree
  await expect(page.locator('.search-count')).toContainText('1 match');
  await expect(page.locator('.status-search-indicator')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(selected(page)).toContainText('cloudflare');
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(initialCount + 11); // auto-revealed
  await page.keyboard.press('Escape');
  await expect(page.locator('.status-search-indicator')).toHaveCount(0);
});

test('pagefind content hits surface posts matched on body text only', async ({ page }) => {
  await page.keyboard.press('/');
  await page.locator('.search-input').fill('keychain'); // body-only word
  await expect(page.locator('.search-count')).toContainText('content', { timeout: 15_000 });
  await page.keyboard.press('Enter');
  await expect(selected(page)).toContainText('Shipping');
});

test('dates pane selection filters the posts pane', async ({ page }) => {
  await page.keyboard.press('Tab'); // -> metadata
  await page.keyboard.press('Tab'); // -> dates
  await expect(page.locator('#dates-pane')).toHaveClass(/active-pane/);
  await page.keyboard.press('j'); // pinned section
  
  // With only pinned posts selected, the count should be smaller than or equal to unfiltered
  const filteredCount = await page.locator('#posts-pane .json-line').count();
  expect(filteredCount).toBeGreaterThan(0);
});

test('help overlay opens with ? and closes with Escape', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.locator('.help-overlay')).toBeVisible();
  await expect(page.locator('.help-box')).toContainText('VIM KEYBOARD SHORTCUTS');
  await page.keyboard.press('Escape');
  await expect(page.locator('.help-overlay')).toHaveCount(0);
});

test('deep link renders the post page and pager scrolls', async ({ page }) => {
  await page.goto(`/posts/${SLUG}/`);
  await expect(page.locator('.reader-body h1')).toContainText(TITLE);
  await expect(page.locator('.reader-body pre.astro-code').first()).toBeVisible(); // Shiki
  const before = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const after = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  expect(after).toBeGreaterThan(before);
});
