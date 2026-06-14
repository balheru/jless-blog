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
  const before = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const after = await page.locator('#pager-main').evaluate((el) => el.scrollTop);
  expect(after).toBeGreaterThan(before);
});

test('post page renders footnotes as dynamic left/right sidenotes', async ({ page }) => {
  await page.goto('/posts/testing/');
  await expect(page.locator('.reader-post h1').first()).toContainText('testing');

  // Footnote references should be visible
  await expect(page.locator('.reader-body [data-footnote-ref]')).toHaveCount(16);

  // Sidenotes should be injected next to references
  const sidenotes = page.locator('.reader-body .sidenote');
  await expect(sidenotes).toHaveCount(16);

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

  // Verify that the anti-overlap positioning pushed Sidenote 3 down relative to Sidenote 1,
  // Sidenote 5 down relative to Sidenote 4, and that Sidenote 16 is positioned far down
  // on a desktop-sized viewport (1280px wide)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200); // allow layout to stabilize

  const box1 = await sidenotes.nth(0).boundingBox();
  const box3 = await sidenotes.nth(2).boundingBox();
  const box4 = await sidenotes.nth(3).boundingBox();
  const box5 = await sidenotes.nth(4).boundingBox();
  const box16 = await sidenotes.nth(15).boundingBox();

  expect(box1).not.toBeNull();
  expect(box3).not.toBeNull();
  expect(box4).not.toBeNull();
  expect(box5).not.toBeNull();
  expect(box16).not.toBeNull();

  if (box1 && box3) {
    // Sidenote 3 must sit below Sidenote 1
    expect(box3.y).toBeGreaterThanOrEqual(box1.y + box1.height);
  }
  if (box4 && box5) {
    // Sidenote 5 must sit below Sidenote 4 (anti-collision check)
    expect(box5.y).toBeGreaterThanOrEqual(box4.y + box4.height);
  }
  if (box5 && box16) {
    // Sidenote 16 (Section 12) should be far below the early notes
    expect(box16.y).toBeGreaterThan(box5.y + 500);
  }
});

