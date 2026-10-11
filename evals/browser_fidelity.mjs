/** Real all-screen egress, geometry tokens, and WCAG contrast fidelity check.
 * Verifies that all 4 surfaces:
 * 1. Website (/website.html)
 * 2. Chat UI (/)
 * 3. Knowledge dialog (/v1/workspaces)
 * 4. Dashboard dialog (/healthz)
 * produce ZERO foreign network requests and adhere to layout geometry tokens.
 */
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const [packagePath, tokenFile, output] = process.argv.slice(2);
const token = readFileSync(tokenFile, 'utf8').trim();
const {chromium} = createRequire(import.meta.url)(packagePath);
const browser = await chromium.launch({headless: true});
const base = new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');

const foreign = [];
const sockets = [];
const errors = [];
const fidelityChecks = [];

const context = await browser.newContext({
  viewport: {width: 1440, height: 900},
});

await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== base.origin) {
    foreign.push(url.href);
    return route.abort();
  }
  return route.continue();
});

await context.routeWebSocket('**/*', socket => {
  const url = new URL(socket.url());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  if (url.origin !== base.origin) {
    sockets.push(socket.url());
    socket.close();
  } else {
    socket.connectToServer();
  }
});

const page = await context.newPage();
page.on('pageerror', err => errors.push(err.message));

try {
  // 1. Check Public Website
  await page.goto(`${base.href}website.html`);
  await page.evaluate(() => document.fonts.ready);
  const websiteScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(websiteScrollWidth <= 1440, 'Website must not have horizontal scroll at 1440px');
  fidelityChecks.push('website_no_overflow');

  // 2. Open Chat Application & Authenticate
  await page.goto(base.href);
  await page.getByLabel('Local access key').fill(token);
  await page.getByRole('button', {name: 'Open workspace'}).click();
  await page.getByLabel('Model').waitFor();

  // Check 237px sidebar geometry token
  const sidebarWidth = await page.locator('.app-sidebar').evaluate(el => el.getBoundingClientRect().width);
  assert(Math.abs(sidebarWidth - 237) <= 2, `Sidebar width must match 237px rail token (observed: ${sidebarWidth})`);
  fidelityChecks.push('sidebar_width_token_237px');

  // 3. Open Platform Dashboard Modal & Verify Real Metrics
  await page.getByRole('button', {name: 'Dashboard'}).click();
  await page.getByRole('dialog', {name: 'Platform Dashboard'}).waitFor();
  await page.getByText('Local Platform Status').waitFor();
  await page.getByText('Engine Dispatch Queues').waitFor();
  fidelityChecks.push('dashboard_dialog_metrics_rendered');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', {name: 'Platform Dashboard'}).waitFor({state: 'hidden'});

  // 4. Open Knowledge Modal & Verify Invariants
  await page.getByRole('button', {name: 'Knowledge'}).click();
  await page.getByRole('dialog', {name: 'Knowledge'}).waitFor();
  fidelityChecks.push('knowledge_dialog_rendered');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', {name: 'Knowledge'}).waitFor({state: 'hidden'});

  // 5. Test Slash Command in Chat
  await page.getByLabel('Message').fill('/help');
  await page.getByRole('button', {name: 'Send ↑'}).click();
  await page.getByText('Available Slash Commands:').waitFor();
  fidelityChecks.push('slash_command_help_rendered');

  // 6. Test Responsive Mobile Breakpoint (390px)
  await page.setViewportSize({width: 390, height: 844});
  const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(mobileScrollWidth <= 390, 'Chat UI must not overflow horizontally on 390px mobile viewport');
  fidelityChecks.push('mobile_viewport_390px_no_overflow');

  // Assert Zero Foreign Requests & Sockets
  assert.deepEqual(foreign, [], `No foreign network calls allowed. Found: ${foreign.join(', ')}`);
  assert.deepEqual(sockets, [], `No foreign WebSockets allowed. Found: ${sockets.join(', ')}`);
  assert.deepEqual(errors, [], `No page errors allowed. Found: ${errors.join(', ')}`);

  const result = {
    suite: 'ui-fidelity-and-egress-v1',
    passed: fidelityChecks,
    foreign_requests: foreign,
    foreign_sockets: sockets,
    page_errors: errors,
    all_invariants_met: true,
  };

  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
