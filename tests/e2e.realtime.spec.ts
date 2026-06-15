// tests/e2e.realtime.spec.ts
import { test, expect, devices } from '@playwright/test';
import fs from 'fs';

const PROD_URL = 'https://lifequest-3968a.vercel.app?debug=true';
const TEST_USERS = [
  { email: 'testuser1@example.com', password: 'Test@1234' },
  { email: 'testuser2@example.com', password: 'Test@1234' },
];

/** Helper to login a user */
async function login(page, { email, password }) {
  await page.goto(PROD_URL);
  // Wait for login form to be visible
  await page.waitForSelector('[data-testid="email"]', { timeout: 15000 });
  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
  await page.click('[data-testid="login-button"]');
  // Wait for app main UI indicator
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
}

/** Helper to measure RTDB latency */
async function measureLatency(page) {
  const start = Date.now();
  // Trigger a latency test using a hidden UI button (debug=true) that writes a timestamp.
  // The app should have a debug endpoint; we'll simulate by invoking a JS function.
  await page.evaluate(() => {
    // @ts-ignore
    window.dispatchEvent(new CustomEvent('debug-latency-test'));
  });
  // Listen for a console log from performanceLogger
  const [msg] = await Promise.race([
    page.waitForEvent('console'),
    new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000)),
  ]).catch(() => []);
  const delta = msg ? Number(msg.text().match(/RTDB latency: (\d+)/)?.[1]) : null;
  return delta;
}

test.describe('Real‑time verification suite', () => {
  test('Login and verify presence payload', async ({ page }) => {
    await login(page, TEST_USERS[0]);
    // Verify presence data appears in UI (simplified)
    const presence = await page.innerText('[data-testid="presence-indicator"]');
    expect(presence).toContain('online');
    // Screenshot
    await page.screenshot({ path: 'artifacts/screenshots/login_user1.png' });
  });

  test('Room creation and payload verification', async ({ page }) => {
    await login(page, TEST_USERS[0]);
    // Open room creation UI
    await page.click('[data-testid="create-room-button"]');
    await page.fill('[data-testid="room-name"]', 'test-room');
    await page.click('[data-testid="confirm-create-room"]');
    // Verify RTDB entry via client SDK snapshot
    const payload = await page.evaluate(async () => {
      const db = (window as any).firebase.database();
      const snap = await db.ref('rooms/test-room').once('value');
      return snap.val();
    });
    expect(payload).toHaveProperty('hostEmail');
    expect(payload).toHaveProperty('hostPeerId');
    expect(payload).toHaveProperty('ownerId');
    expect(payload).toHaveProperty('createdAt');
    await page.screenshot({ path: 'artifacts/screenshots/room_created.png' });
  });

  test('RTDB listener latency', async ({ page }) => {
    await login(page, TEST_USERS[0]);
    const latency = await measureLatency(page);
    console.log('Measured RTDB latency:', latency);
    expect(latency).not.toBeNull();
    // Store latency for report (write to file via node later)
    await page.evaluate((val) => {
      // @ts-ignore
      window.__rtdb_latency = val;
    }, latency);
    await page.screenshot({ path: 'artifacts/screenshots/latency.png' });
  });

  test('Join request flow', async ({ page, browser }) => {
    // Two contexts for two users
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await login(pageA, TEST_USERS[0]);
    await login(pageB, TEST_USERS[1]);

    // User A creates room
    await pageA.click('[data-testid="create-room-button"]');
    await pageA.fill('[data-testid="room-name"]', 'join-test-room');
    await pageA.click('[data-testid="confirm-create-room"]');

    // User B sends join request
    await pageB.fill('[data-testid="join-room-input"]', 'join-test-room');
    await pageB.click('[data-testid="join-request-button"]');

    // User A receives request and accepts
    await pageA.waitForSelector('[data-testid="join-request-notification"]');
    await pageA.click('[data-testid="accept-join-button"]');

    // Verify both are in room (presence count)
    const countA = await pageA.innerText('[data-testid="participant-count"]');
    const countB = await pageB.innerText('[data-testid="participant-count"]');
    expect(countA).toBe('2');
    expect(countB).toBe('2');

    await pageA.screenshot({ path: 'artifacts/screenshots/join_accepted_A.png' });
    await pageB.screenshot({ path: 'artifacts/screenshots/join_accepted_B.png' });

    await contextA.close();
    await contextB.close();
  });

  test('WebRTC connection matrix', async ({ browser }) => {
    // Device descriptors from Playwright
    const deviceDescriptors = [
      { name: 'Desktop', options: {} },
      { name: 'Android', options: { ...devices['Pixel 5'] } },
      { name: 'iPhone', options: { ...devices['iPhone 13'] } },
    ];

    const results: any[] = [];
    for (let i = 0; i < deviceDescriptors.length; i++) {
      for (let j = i + 1; j < deviceDescriptors.length; j++) {
        const ctxA = await browser.newContext(deviceDescriptors[i].options);
        const ctxB = await browser.newContext(deviceDescriptors[j].options);
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();
        await login(pageA, TEST_USERS[0]);
        await login(pageB, TEST_USERS[1]);
        // Create room by A
        await pageA.click('[data-testid="create-room-button"]');
        await pageA.fill('[data-testid="room-name"]', `webrtc-${deviceDescriptors[i].name}-${deviceDescriptors[j].name}`);
        await pageA.click('[data-testid="confirm-create-room"]');
        // B requests join
        await pageB.fill('[data-testid="join-room-input"]', `webrtc-${devices[i].name}-${devices[j].name}`);
        await pageB.click('[data-testid="join-request-button"]');
        await pageA.waitForSelector('[data-testid="join-request-notification"]');
        await pageA.click('[data-testid="accept-join-button"]');
        // Initiate call
        await pageA.click('[data-testid="start-call-button"]');
        // Wait for ICE connection state change event captured via console
        const iceStates: string[] = [];
        pageA.on('console', msg => {
          const text = msg.text();
          if (text.includes('ICE state')) iceStates.push(text);
        });
        // Give some time for negotiation
        await pageA.waitForTimeout(8000);
        const hasRelay = iceStates.some(s => s.includes('relay'));
        results.push({ pair: `${devices[i].name}-${devices[j].name}`, iceStates, hasRelay });
        await pageA.screenshot({ path: `artifacts/screenshots/webrtc_${devices[i].name}_${devices[j].name}.png` });
        await ctxA.close();
        await ctxB.close();
      }
    }
    // Write matrix results to a JSON file for the report
    await fs.promises.writeFile('artifacts/webrtc_matrix.json', JSON.stringify(results, null, 2));
    expect(results.every(r => r.hasRelay)).toBeTruthy(); // TURN must be present
  });
});
