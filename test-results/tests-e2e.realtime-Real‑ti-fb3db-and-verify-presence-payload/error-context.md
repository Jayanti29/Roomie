# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e.realtime.spec.ts >> Real‑time verification suite >> Login and verify presence payload
- Location: tests/e2e.realtime.spec.ts:40:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="email"]')

```

# Page snapshot

```yaml
- main [ref=e3]:
  - paragraph [ref=e4]:
    - generic [ref=e5]:
      - strong [ref=e6]: "404"
      - text: ": NOT_FOUND"
    - generic [ref=e7]:
      - text: "Code:"
      - code [ref=e8]: "`DEPLOYMENT_NOT_FOUND`"
    - generic [ref=e9]:
      - text: "ID:"
      - code [ref=e10]: "`bom1::45vcr-1781513100573-9315a8adfd2d`"
  - link "This deployment cannot be found. For more information and troubleshooting, see our documentation." [ref=e11] [cursor=pointer]:
    - /url: https://vercel.com/docs/errors/DEPLOYMENT_NOT_FOUND
    - generic [ref=e12]: This deployment cannot be found. For more information and troubleshooting, see our documentation.
```

# Test source

```ts
  1   | // tests/e2e.realtime.spec.ts
  2   | import { test, expect, devices } from '@playwright/test';
  3   | 
  4   | const PROD_URL = 'https://lifequest-3968a.vercel.app?debug=true';
  5   | const TEST_USERS = [
  6   |   { email: 'testuser1@example.com', password: 'Test@1234' },
  7   |   { email: 'testuser2@example.com', password: 'Test@1234' },
  8   | ];
  9   | 
  10  | /** Helper to login a user */
  11  | async function login(page, { email, password }) {
  12  |   await page.goto(PROD_URL);
  13  |   // Assuming a login form with selectors "[data-testid='email']" etc.
> 14  |   await page.fill('[data-testid="email"]', email);
      |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  15  |   await page.fill('[data-testid="password"]', password);
  16  |   await page.click('[data-testid="login-button"]');
  17  |   // Wait for app main UI indicator
  18  |   await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  19  | }
  20  | 
  21  | /** Helper to measure RTDB latency */
  22  | async function measureLatency(page) {
  23  |   const start = Date.now();
  24  |   // Trigger a latency test using a hidden UI button (debug=true) that writes a timestamp.
  25  |   // The app should have a debug endpoint; we'll simulate by invoking a JS function.
  26  |   await page.evaluate(() => {
  27  |     // @ts-ignore
  28  |     window.dispatchEvent(new CustomEvent('debug-latency-test'));
  29  |   });
  30  |   // Listen for a console log from performanceLogger
  31  |   const [msg] = await Promise.race([
  32  |     page.waitForEvent('console'),
  33  |     new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000)),
  34  |   ]).catch(() => []);
  35  |   const delta = msg ? Number(msg.text().match(/RTDB latency: (\d+)/)?.[1]) : null;
  36  |   return delta;
  37  | }
  38  | 
  39  | test.describe('Real‑time verification suite', () => {
  40  |   test('Login and verify presence payload', async ({ page }) => {
  41  |     await login(page, TEST_USERS[0]);
  42  |     // Verify presence data appears in UI (simplified)
  43  |     const presence = await page.innerText('[data-testid="presence-indicator"]');
  44  |     expect(presence).toContain('online');
  45  |     // Screenshot
  46  |     await page.screenshot({ path: 'artifacts/screenshots/login_user1.png' });
  47  |   });
  48  | 
  49  |   test('Room creation and payload verification', async ({ page }) => {
  50  |     await login(page, TEST_USERS[0]);
  51  |     // Open room creation UI
  52  |     await page.click('[data-testid="create-room-button"]');
  53  |     await page.fill('[data-testid="room-name"]', 'test-room');
  54  |     await page.click('[data-testid="confirm-create-room"]');
  55  |     // Verify RTDB entry via client SDK snapshot
  56  |     const payload = await page.evaluate(async () => {
  57  |       const db = (window as any).firebase.database();
  58  |       const snap = await db.ref('rooms/test-room').once('value');
  59  |       return snap.val();
  60  |     });
  61  |     expect(payload).toHaveProperty('hostEmail');
  62  |     expect(payload).toHaveProperty('hostPeerId');
  63  |     expect(payload).toHaveProperty('ownerId');
  64  |     expect(payload).toHaveProperty('createdAt');
  65  |     await page.screenshot({ path: 'artifacts/screenshots/room_created.png' });
  66  |   });
  67  | 
  68  |   test('RTDB listener latency', async ({ page }) => {
  69  |     await login(page, TEST_USERS[0]);
  70  |     const latency = await measureLatency(page);
  71  |     console.log('Measured RTDB latency:', latency);
  72  |     expect(latency).not.toBeNull();
  73  |     // Store latency for report (write to file via node later)
  74  |     await page.evaluate((val) => {
  75  |       // @ts-ignore
  76  |       window.__rtdb_latency = val;
  77  |     }, latency);
  78  |     await page.screenshot({ path: 'artifacts/screenshots/latency.png' });
  79  |   });
  80  | 
  81  |   test('Join request flow', async ({ page, browser }) => {
  82  |     // Two contexts for two users
  83  |     const contextA = await browser.newContext();
  84  |     const pageA = await contextA.newPage();
  85  |     const contextB = await browser.newContext();
  86  |     const pageB = await contextB.newPage();
  87  | 
  88  |     await login(pageA, TEST_USERS[0]);
  89  |     await login(pageB, TEST_USERS[1]);
  90  | 
  91  |     // User A creates room
  92  |     await pageA.click('[data-testid="create-room-button"]');
  93  |     await pageA.fill('[data-testid="room-name"]', 'join-test-room');
  94  |     await pageA.click('[data-testid="confirm-create-room"]');
  95  | 
  96  |     // User B sends join request
  97  |     await pageB.fill('[data-testid="join-room-input"]', 'join-test-room');
  98  |     await pageB.click('[data-testid="join-request-button"]');
  99  | 
  100 |     // User A receives request and accepts
  101 |     await pageA.waitForSelector('[data-testid="join-request-notification"]');
  102 |     await pageA.click('[data-testid="accept-join-button"]');
  103 | 
  104 |     // Verify both are in room (presence count)
  105 |     const countA = await pageA.innerText('[data-testid="participant-count"]');
  106 |     const countB = await pageB.innerText('[data-testid="participant-count"]');
  107 |     expect(countA).toBe('2');
  108 |     expect(countB).toBe('2');
  109 | 
  110 |     await pageA.screenshot({ path: 'artifacts/screenshots/join_accepted_A.png' });
  111 |     await pageB.screenshot({ path: 'artifacts/screenshots/join_accepted_B.png' });
  112 | 
  113 |     await contextA.close();
  114 |     await contextB.close();
```