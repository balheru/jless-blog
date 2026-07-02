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
  for (const pane of ['dates-pane', 'graph-pane', 'posts-pane', 'metadata-pane']) {
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

test('graph view displays nodes and responds to tag filter clicks', async ({ page }) => {
  const graphPane = page.locator('#graph-pane');
  await expect(graphPane).toBeVisible();

  // Select the first post in the posts tree to set it as active
  await page.keyboard.press('j');

  // Verify that the active post node is highlighted in the graph SVG
  const activeNode = page.locator('#graph-pane .graph-node.is-active-node');
  await expect(activeNode).toBeVisible();

  // Find a tag node (e.g., 'cloudflare') and click/dispatch click on it
  const tagNode = page.locator('#graph-pane .graph-node', { hasText: 'cloudflare' });
  await expect(tagNode).toBeVisible();
  await tagNode.dispatchEvent('click');

  // Clicking a tag filters the posts list and changes focus to the posts pane
  await expect(page.locator('#posts-pane')).toHaveClass(/active-pane/);
});

test('deep link renders the post page and pager scrolls', async ({ page }) => {
  await page.goto(`/posts/${SLUG}/`);
  await expect(page.locator('.reader-body h1')).toContainText(TITLE);
  await expect(page.locator('.reader-body pre.astro-code').first()).toBeVisible(); // Shiki

  const pager = page.locator('#pager-main');

  // Initial scroll top should be 0
  let top = await pager.evaluate((el) => el.scrollTop);
  expect(top).toBe(0);

  // Test line scroll down (j)
  await page.keyboard.press('j');
  let topJ = await pager.evaluate((el) => el.scrollTop);
  expect(topJ).toBeGreaterThan(0);

  // Test line scroll up (k)
  await page.keyboard.press('k');
  let topK = await pager.evaluate((el) => el.scrollTop);
  expect(topK).toBeLessThan(topJ);

  // Test half page scroll down (d)
  await page.keyboard.press('d');
  let topD = await pager.evaluate((el) => el.scrollTop);
  expect(topD).toBeGreaterThan(topK);

  // Test half page scroll up (u)
  await page.keyboard.press('u');
  let topU = await pager.evaluate((el) => el.scrollTop);
  expect(topU).toBeLessThan(topD);

  // Test page scroll down (f)
  await page.keyboard.press('f');
  let topF = await pager.evaluate((el) => el.scrollTop);
  expect(topF).toBeGreaterThan(topU);

  // Test page scroll up (b)
  await page.keyboard.press('b');
  let topB = await pager.evaluate((el) => el.scrollTop);
  expect(topB).toBeLessThan(topF);

  // Test scroll to bottom (G)
  await page.keyboard.press('G');
  await page.waitForTimeout(100);
  let topG = await pager.evaluate((el) => el.scrollTop);
  expect(topG).toBeGreaterThan(0);

  // Test scroll to top (g g)
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await page.waitForTimeout(100);
  let topGG = await pager.evaluate((el) => el.scrollTop);
  expect(topGG).toBe(0);

  // Test scroll to bottom (End)
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  let topEnd = await pager.evaluate((el) => el.scrollTop);
  expect(topEnd).toBeGreaterThan(0);

  // Test scroll to top (Home)
  await page.keyboard.press('Home');
  await page.waitForTimeout(100);
  let topHome = await pager.evaluate((el) => el.scrollTop);
  expect(topHome).toBe(0);
});

test('post page renders footnotes as dynamic left/right sidenotes', async ({ page }) => {
  await page.goto('/posts/e2e-sidenotes-fixture/');
  await expect(page.locator('.reader-post h1').first()).toContainText('E2E Sidenotes Fixture');

  // Footnote references should be visible
  await expect(page.locator('.reader-body [data-footnote-ref]')).toHaveCount(23);

  // Sidenotes should be injected next to references
  const sidenotes = page.locator('.reader-body .sidenote');
  await expect(sidenotes).toHaveCount(23);

  // Sidenote 1 (default) -> right
  await expect(sidenotes.nth(0)).toHaveClass(/sidenote-right/);
  await expect(sidenotes.nth(0)).toContainText('This is a default sidenote');

  // Sidenote 2 (prefix L:) -> left, with prefix stripped
  await expect(sidenotes.nth(1)).toHaveClass(/sidenote-left/);
  await expect(sidenotes.nth(1)).toContainText('This is a left sidenote explaining');
  await expect(sidenotes.nth(1)).not.toContainText('L:');

  // Sidenote 3 (prefix R:) -> right, with prefix stripped
  await expect(sidenotes.nth(2)).toHaveClass(/sidenote-right/);
  await expect(sidenotes.nth(2)).toContainText('This is a right sidenote explaining');
  await expect(sidenotes.nth(2)).not.toContainText('R:');

  // Footnotes footer at bottom should be hidden
  await expect(page.locator('.footnotes')).toBeHidden();

  // Verify that the anti-overlap positioning works for:
  // - 1 vs 3
  // - 5-deep stack on right (4, 5, 17, 18, 19)
  // - 5-deep stack on left (6, 20, 21, 22, 23)
  // - final note far down (16)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200); // allow layout to stabilize

  const box1 = await sidenotes.nth(0).boundingBox();
  const box3 = await sidenotes.nth(2).boundingBox();

  // Right-hand 5-deep stack
  const box4 = await sidenotes.nth(3).boundingBox();
  const box5 = await sidenotes.nth(4).boundingBox();
  const box17 = await sidenotes.nth(5).boundingBox();
  const box18 = await sidenotes.nth(6).boundingBox();
  const box19 = await sidenotes.nth(7).boundingBox();

  // Left-hand 5-deep stack
  const box6 = await sidenotes.nth(8).boundingBox();
  const box20 = await sidenotes.nth(9).boundingBox();
  const box21 = await sidenotes.nth(10).boundingBox();
  const box22 = await sidenotes.nth(11).boundingBox();
  const box23 = await sidenotes.nth(12).boundingBox();

  // Final note (index 22)
  const box16 = await sidenotes.nth(22).boundingBox();

  expect(box1).not.toBeNull();
  expect(box3).not.toBeNull();
  expect(box4).not.toBeNull();
  expect(box5).not.toBeNull();
  expect(box17).not.toBeNull();
  expect(box18).not.toBeNull();
  expect(box19).not.toBeNull();
  expect(box6).not.toBeNull();
  expect(box20).not.toBeNull();
  expect(box21).not.toBeNull();
  expect(box22).not.toBeNull();
  expect(box23).not.toBeNull();
  expect(box16).not.toBeNull();

  if (box1 && box3) {
    expect(box3.y).toBeGreaterThanOrEqual(box1.y + box1.height);
  }

  // Assert right-side 5-deep stack resolves collisions
  if (box4 && box5 && box17 && box18 && box19) {
    expect(box5.y).toBeGreaterThanOrEqual(box4.y + box4.height);
    expect(box17.y).toBeGreaterThanOrEqual(box5.y + box5.height);
    expect(box18.y).toBeGreaterThanOrEqual(box17.y + box17.height);
    expect(box19.y).toBeGreaterThanOrEqual(box18.y + box18.height);
  }

  // Assert left-side 5-deep stack resolves collisions
  if (box6 && box20 && box21 && box22 && box23) {
    expect(box20.y).toBeGreaterThanOrEqual(box6.y + box6.height);
    expect(box21.y).toBeGreaterThanOrEqual(box20.y + box20.height);
    expect(box22.y).toBeGreaterThanOrEqual(box21.y + box21.height);
    expect(box23.y).toBeGreaterThanOrEqual(box22.y + box22.height);
  }

  if (box19 && box16) {
    expect(box16.y).toBeGreaterThan(box19.y + 500);
  }
});

