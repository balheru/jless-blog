import { expect, test, type Page } from '@playwright/test';

const selected = (page: Page, pane = 'posts') =>
  page.locator(`#${pane}-pane .json-line.selected`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(80);
});

test('renders all panes with the posts tree and status bar', async ({ page }) => {
  for (const pane of ['dates-pane', 'posts-pane', 'metadata-pane', 'reader-pane']) {
    await expect(page.locator(`#${pane}`)).toBeVisible();
  }
  await expect(page.locator('#posts-pane')).toHaveClass(/active-pane/);
  await expect(selected(page)).toContainText('"posts"');
  await expect(page.locator('.app-footer')).toContainText('MODE: NORMAL');
  await expect(page.locator('.app-footer')).toContainText('PANE: POSTS');
});

test('j/k navigation syncs the reader preview', async ({ page }) => {
  await page.keyboard.press('j');
  await expect(selected(page)).toContainText('Welcome to my Hacker Blog');
  await expect(page.locator('#reader-pane .pane-header')).toContainText(
    'Welcome to my Hacker Blog'
  );
  // body fetched on demand from the post page
  await expect(page.locator('#reader-pane .reader-body')).toContainText('Why build this?');
  await page.keyboard.press('k');
  await expect(selected(page)).toContainText('"posts"');
});

test('fold keys: l expands, h collapses, h jumps to parent from a leaf (prototype regression)', async ({ page }) => {
  await page.keyboard.press('j');
  await page.keyboard.press('l'); // expand post
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(92);
  await page.keyboard.press('j'); // title leaf
  await expect(selected(page)).toContainText('"title"');
  await page.keyboard.press('h'); // leaf -> parent opening (was a no-op in the prototype)
  await expect(selected(page)).toContainText('{');
  await expect(selected(page)).not.toContainText('"title":');
  await page.keyboard.press('h'); // collapse
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(80);
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

test('c collapses the focused node and its siblings', async ({ page }) => {
  await page.keyboard.press('j');
  await page.keyboard.press('l');
  await page.keyboard.press('J'); // next sibling post
  await page.keyboard.press('l'); // expand it too
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(104);
  await page.keyboard.press('c');
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(80);
});

test('reader round trip: Enter opens the post page, ]/[ navigate, q restores selection and navigation keeps working (prototype regressions)', async ({ page }) => {
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/posts\/welcome-to-jless-blog\//);
  await expect(page.locator('.app-footer')).toContainText('MODE: PAGER');

  await page.keyboard.press(']'); // next post (was dead in the prototype)
  await expect(page).toHaveURL(/\/posts\/keyboard-driven-javascript\//);
  await page.keyboard.press('[');
  await expect(page).toHaveURL(/\/posts\/welcome-to-jless-blog\//);

  await page.keyboard.press('q');
  await expect(page).toHaveURL(/\/$|\?/);
  await expect(selected(page)).toContainText('Welcome to my Hacker Blog');

  // navigation must still work after returning (prototype froze here)
  await page.keyboard.press('j');
  await expect(selected(page)).toContainText('Building Focus-Controlled');
});

test('search finds tags hidden inside collapsed posts and reveals them (prototype regression)', async ({ page }) => {
  await page.keyboard.press('/');
  await page.locator('.search-input').fill('accessibility');
  await expect(page.locator('.search-count')).toContainText('1 match');
  await expect(page.locator('.status-search-indicator')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(selected(page)).toContainText('accessibility');
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(92); // auto-revealed
  await page.keyboard.press('Escape');
  await expect(page.locator('.status-search-indicator')).toHaveCount(0);
});

test('pagefind content hits surface posts matched on body text only', async ({ page }) => {
  await page.keyboard.press('/');
  await page.locator('.search-input').fill('conserved'); // body-only word
  await expect(page.locator('.search-count')).toContainText('content', { timeout: 15_000 });
  await page.keyboard.press('Enter');
  await expect(selected(page)).toContainText('Emmy Noether');
});

test('f filters by tag, Esc clears the filter before search highlights', async ({ page }) => {
  await page.keyboard.press('j');
  await page.keyboard.press('l');
  for (let i = 0; i < 5; i++) await page.keyboard.press('j'); // first tag leaf
  await expect(selected(page)).toContainText('hacker');
  await page.keyboard.press('f');
  await expect(page.locator('.status-filter-indicator')).toContainText('FILTER: hacker');
  expect(await page.locator('#posts-pane .json-line').count()).toBeLessThan(80);
  await page.keyboard.press('Escape');
  await expect(page.locator('.status-filter-indicator')).toHaveCount(0);
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(80);
});

test('dates pane selection filters the posts pane', async ({ page }) => {
  await page.keyboard.press('Tab'); // -> metadata
  await page.keyboard.press('Tab'); // -> dates
  await expect(page.locator('#dates-pane')).toHaveClass(/active-pane/);
  await page.keyboard.press('j'); // pinned section
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(3);
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.locator('#posts-pane .json-line')).toHaveCount(80);
});

test('help overlay opens with ? and closes with Escape', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.locator('.help-overlay')).toBeVisible();
  await expect(page.locator('.help-box')).toContainText('VIM KEYBOARD SHORTCUTS');
  await page.keyboard.press('Escape');
  await expect(page.locator('.help-overlay')).toHaveCount(0);
});

test('deep link renders the post page and pager scrolls', async ({ page }) => {
  await page.goto('/posts/keyboard-driven-javascript/');
  await expect(page.locator('.reader-body h1')).toContainText('Keyboard-Driven Web Interfaces');
  await expect(page.locator('.reader-body pre.astro-code').first()).toBeVisible(); // Shiki
  const before = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const after = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  expect(after).toBeGreaterThan(before);
});
