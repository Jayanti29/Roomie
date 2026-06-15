# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e.realtime.spec.ts >> Real‑time verification suite >> WebRTC connection matrix
- Location: tests/e2e.realtime.spec.ts:117:3

# Error details

```
ReferenceError: Cannot access 'devices' before initialization
```

# Test source

```ts
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
  115 |   });
  116 | 
  117 |   test('WebRTC connection matrix', async ({ browser }) => {
  118 |     // Device descriptors from Playwright
  119 |     const devices = [
  120 |       { name: 'Desktop', options: {} },
> 121 |       { name: 'Android', options: { ...devices['Pixel 5'] } },
      |                                        ^ ReferenceError: Cannot access 'devices' before initialization
  122 |       { name: 'iPhone', options: { ...devices['iPhone 13'] } },
  123 |     ];
  124 | 
  125 |     const results: any[] = [];
  126 |     for (let i = 0; i < devices.length; i++) {
  127 |       for (let j = i + 1; j < devices.length; j++) {
  128 |         const ctxA = await browser.newContext(devices[i].options);
  129 |         const ctxB = await browser.newContext(devices[j].options);
  130 |         const pageA = await ctxA.newPage();
  131 |         const pageB = await ctxB.newPage();
  132 |         await login(pageA, TEST_USERS[0]);
  133 |         await login(pageB, TEST_USERS[1]);
  134 |         // Create room by A
  135 |         await pageA.click('[data-testid="create-room-button"]');
  136 |         await pageA.fill('[data-testid="room-name"]', `webrtc-${devices[i].name}-${devices[j].name}`);
  137 |         await pageA.click('[data-testid="confirm-create-room"]');
  138 |         // B requests join
  139 |         await pageB.fill('[data-testid="join-room-input"]', `webrtc-${devices[i].name}-${devices[j].name}`);
  140 |         await pageB.click('[data-testid="join-request-button"]');
  141 |         await pageA.waitForSelector('[data-testid="join-request-notification"]');
  142 |         await pageA.click('[data-testid="accept-join-button"]');
  143 |         // Initiate call
  144 |         await pageA.click('[data-testid="start-call-button"]');
  145 |         // Wait for ICE connection state change event captured via console
  146 |         const iceStates: string[] = [];
  147 |         pageA.on('console', msg => {
  148 |           const text = msg.text();
  149 |           if (text.includes('ICE state')) iceStates.push(text);
  150 |         });
  151 |         // Give some time for negotiation
  152 |         await pageA.waitForTimeout(8000);
  153 |         const hasRelay = iceStates.some(s => s.includes('relay'));
  154 |         results.push({ pair: `${devices[i].name}-${devices[j].name}`, iceStates, hasRelay });
  155 |         await pageA.screenshot({ path: `artifacts/screenshots/webrtc_${devices[i].name}_${devices[j].name}.png` });
  156 |         await ctxA.close();
  157 |         await ctxB.close();
  158 |       }
  159 |     }
  160 |     // Write matrix results to a JSON file for the report
  161 |     await require('fs').promises.writeFile('artifacts/webrtc_matrix.json', JSON.stringify(results, null, 2));
  162 |     expect(results.every(r => r.hasRelay)).toBeTruthy(); // TURN must be present
  163 |   });
  164 | });
  165 | 
```