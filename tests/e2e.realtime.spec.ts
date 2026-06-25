// tests/e2e.realtime.spec.ts
import { test, expect, devices, Page, Browser, ConsoleMessage } from '@playwright/test';
import fs from 'fs';

const PROD_URL = process.env.TEST_URL || 'https://roomie-platform.vercel.app?debug=true';
const TEST_USERS: TestUser[] = [
  { email: 'testuser1@example.com', password: 'Test@1234' },
  { email: 'testuser2@example.com', password: 'Test@1234' },
];

interface TestUser {
  email: string;
  password: string;
}

interface DeviceDescriptor {
  name: string;
  options: Record<string, unknown>;
}

interface WindowWithFirebase {
  firebase: {
    database: () => {
      ref: (path: string) => {
        once: (eventType: string) => Promise<{ val: () => unknown }>;
      };
    };
  };
}

/** Helper to login a user */
async function login(page: Page, { email, password }: TestUser): Promise<void> {
  await page.goto(PROD_URL);
  try {
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
  } catch (e: unknown) {}
  // Wait for login form to be visible
  await page.waitForSelector('[data-testid="email"]', { timeout: 15000 });
  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
  await page.click('[data-testid="login-button"]', { force: true });
  // Wait for app main UI indicator
  try {
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 });
  } catch (err: unknown) {
    console.log(`Login failed for ${email}, attempting registration...`);
    // Click register toggle
    await page.click('button:has-text("NEW STUDENT? CREATE ACCOUNT")', { force: true });
    // Fill registration fields
    await page.fill('[data-testid="name"]', email.split('@')[0]);
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"]', password);
    await page.fill('input[placeholder="Confirm Password"]', password);
    // Click register button
    await page.click('[data-testid="login-button"]', { force: true });
    // Wait for app main UI indicator
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 });
  }

  // If the user is already in an active study room (due to previous tests), leave it to return to dashboard
  try {
    const leaveBtn = page.locator('button:has-text("LEAVE ROOM")');
    if (await leaveBtn.count() > 0) {
      console.log(`User ${email} was found in an active room. Leaving room...`);
      await leaveBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
    }
  } catch (e: unknown) {
    console.log("No active room to leave during login setup");
  }
}

/** Helper to measure RTDB latency */
async function measureLatency(page: Page): Promise<number | null> {
  const start = Date.now();
  // Trigger a latency test using a hidden UI button (debug=true) that writes a timestamp.
  // The app should have a debug endpoint; we'll simulate by invoking a JS function.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('debug-latency-test'));
  });
  // Listen for a console log from performanceLogger
  const msg = await Promise.race([
    page.waitForEvent('console'),
    new Promise<ConsoleMessage>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]).catch(() => null);
  const delta = msg ? Number(msg.text().match(/RTDB latency: (\d+)/)?.[1]) : null;
  return delta;
}

/** Helper to run WebRTC matrix test on a single device pair */
async function runWebRTCMatrixPair(browser: Browser, dev1: DeviceDescriptor, dev2: DeviceDescriptor): Promise<boolean> {
  const ctxA = await browser.newContext({
    ...dev1.options,
    permissions: ['microphone', 'camera']
  });
  const ctxB = await browser.newContext({
    ...dev2.options,
    permissions: ['microphone', 'camera']
  });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  
  const iceStates: string[] = [];
  pageA.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    console.log(`[pageA Console] ${msg.type()}: ${text}`);
    if (text.includes('ICE state')) iceStates.push(text);
  });
  pageB.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    console.log(`[pageB Console] ${msg.type()}: ${text}`);
  });

  await login(pageA, TEST_USERS[0]);
  await login(pageB, TEST_USERS[1]);
  
  // Create room by A (use programmatic click to bypass emulated notch/safe-area/animation click issues)
  await pageA.locator('[data-testid="create-room-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
  await pageA.fill('[data-testid="room-name"]', `webrtc-${dev1.name}-${dev2.name}`);
  await pageA.locator('[data-testid="confirm-create-room"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
  
  // B requests join
  await pageB.locator('[data-testid="create-room-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
  await pageB.fill('[data-testid="join-room-input"]', `webrtc-${dev1.name}-${dev2.name}`);
  await pageB.locator('[data-testid="join-request-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
  
  // A receives request and accepts
  await pageA.waitForSelector('[data-testid="join-request-notification"]', { timeout: 30000 });
  await pageA.locator('[data-testid="accept-join-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
  
  // Wait for both to enter the room
  await expect(pageA.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 20000 });
  await expect(pageB.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 20000 });

  // Initiate call
  await pageA.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-call-button"]') as HTMLButtonElement | null;
    if (btn) btn.click();
  });
  // Give some time for negotiation
  await pageA.waitForTimeout(8000);
  const hasRelay = iceStates.some(s => s.includes('relay'));
  const result = { pair: `${dev1.name}-${dev2.name}`, iceStates, hasRelay };
  
  try {
    await fs.promises.mkdir('artifacts/screenshots', { recursive: true });
  } catch (e: unknown) {}
  await pageA.screenshot({ path: `artifacts/screenshots/webrtc_${dev1.name}_${dev2.name}.png` });
  
  await ctxA.close();
  await ctxB.close();

  // Aggregate results in artifacts/webrtc_matrix.json
  let currentMatrix: any[] = [];
  try {
    const content = await fs.promises.readFile('artifacts/webrtc_matrix.json', 'utf8');
    currentMatrix = JSON.parse(content);
  } catch (e: unknown) {}
  currentMatrix = currentMatrix.filter(r => r.pair !== result.pair);
  currentMatrix.push(result);
  await fs.promises.writeFile('artifacts/webrtc_matrix.json', JSON.stringify(currentMatrix, null, 2));

  return hasRelay;
}

test.describe('Real‑time verification suite', () => {
  test('Login and verify presence payload', async ({ page }: { page: Page }) => {
    await login(page, TEST_USERS[0]);
    // Verify presence data appears in UI (simplified)
    const presence = await page.innerText('[data-testid="presence-indicator"]');
    expect(presence).toContain('online');
    // Screenshot
    await page.screenshot({ path: 'artifacts/screenshots/login_user1.png' });
  });

  test('Room creation and payload verification', async ({ page }: { page: Page }) => {
    await login(page, TEST_USERS[0]);
    // Open room creation UI (use programmatic click)
    await page.locator('[data-testid="create-room-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
    await page.fill('[data-testid="room-name"]', 'test-room');
    await page.locator('[data-testid="confirm-create-room"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
    // Verify RTDB entry via client SDK snapshot
    const payload = await page.evaluate(async () => {
      const db = (window as unknown as WindowWithFirebase).firebase.database();
      const snap = await db.ref('rooms/test-room').once('value');
      return snap.val();
    });
    expect(payload).toHaveProperty('hostEmail');
    expect(payload).toHaveProperty('hostPeerId');
    expect(payload).toHaveProperty('ownerId');
    expect(payload).toHaveProperty('createdAt');
    await page.screenshot({ path: 'artifacts/screenshots/room_created.png' });
  });

  test('RTDB listener latency', async ({ page }: { page: Page }) => {
    await login(page, TEST_USERS[0]);
    const latency = await measureLatency(page);
    console.log('Measured RTDB latency:', latency);
    if (latency === null) {
      throw new Error('RTDB latency was not measured.');
    }
    expect(Number.isFinite(latency), 'RTDB latency must be finite').toBe(true);
    expect(latency).toBeGreaterThanOrEqual(0);
    // Store latency for report (write to file via node later)
    await page.evaluate((val) => {
      (window as unknown as Record<string, unknown>).__rtdb_latency = val;
    }, latency);
    await page.screenshot({ path: 'artifacts/screenshots/latency.png' });
  });

  test('Join request flow', async ({ page, browser }: { page: Page; browser: Browser }) => {
    // Two contexts for two users
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await login(pageA, TEST_USERS[0]);
    await login(pageB, TEST_USERS[1]);

    // User A creates room (use programmatic click)
    await pageA.locator('[data-testid="create-room-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
    await pageA.fill('[data-testid="room-name"]', 'join-test-room');
    await pageA.locator('[data-testid="confirm-create-room"]').evaluate((el: Element) => (el as HTMLButtonElement).click());

    // User B sends join request (use programmatic click)
    await pageB.locator('[data-testid="create-room-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());
    await pageB.fill('[data-testid="join-room-input"]', 'join-test-room');
    await pageB.locator('[data-testid="join-request-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());

    // User A receives request and accepts
    await pageA.waitForSelector('[data-testid="join-request-notification"]');
    await pageA.locator('[data-testid="accept-join-button"]').evaluate((el: Element) => (el as HTMLButtonElement).click());

    // Verify both are in room (presence count)
    await expect(pageA.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });
    await expect(pageB.locator('[data-testid="participant-count"]')).toHaveText('2', { timeout: 10000 });

    await pageA.screenshot({ path: 'artifacts/screenshots/join_accepted_A.png' });
    await pageB.screenshot({ path: 'artifacts/screenshots/join_accepted_B.png' });

    await contextA.close();
    await contextB.close();
  });

  test('WebRTC connection matrix - Desktop vs Android', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120000);
    const hasRelay = await runWebRTCMatrixPair(
      browser,
      { name: 'Desktop', options: {} },
      { name: 'Android', options: { ...devices['Pixel 5'] } }
    );
    expect(hasRelay).toBeTruthy();
  });

  test('WebRTC connection matrix - Desktop vs iPhone', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120000);
    const hasRelay = await runWebRTCMatrixPair(
      browser,
      { name: 'Desktop', options: {} },
      { name: 'iPhone', options: { ...devices['iPhone 13'] } }
    );
    expect(hasRelay).toBeTruthy();
  });

  test('WebRTC connection matrix - Android vs iPhone', async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120000);
    const hasRelay = await runWebRTCMatrixPair(
      browser,
      { name: 'Android', options: { ...devices['Pixel 5'] } },
      { name: 'iPhone', options: { ...devices['iPhone 13'] } }
    );
    expect(hasRelay).toBeTruthy();
  });
});
