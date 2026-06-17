// tests/production.verification.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'fs';

const PROD_URL = 'https://roomie-platform.vercel.app?debug=true';
const TEST_USER = { email: 'testuser1@example.com', password: 'Test@1234' };

test('Production Audit and Screenshot Capture', async ({ page }) => {
  test.setTimeout(60000);
  
  // 1. Open live Vercel deployment
  console.log('Opening production URL...');
  await page.goto(PROD_URL);
  
  // Disable animations and transitions for clean screenshots
  try {
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
  } catch (e) {}

  // Verify page title contains ROOMIE
  const title = await page.title();
  console.log(`Page title: ${title}`);
  expect(title.toUpperCase()).toContain('ROOMIE');

  // Wait for login UI
  await page.waitForSelector('[data-testid="email"]', { timeout: 15000 });

  // 2. Capture Login Screen Screenshot
  console.log('Capturing login screen...');
  await page.screenshot({ path: 'artifacts/screenshots/live_login.png' });

  // Fill in login details
  await page.fill('[data-testid="email"]', TEST_USER.email);
  await page.fill('[data-testid="password"]', TEST_USER.password);
  await page.click('[data-testid="login-button"]', { force: true });

  // 3. Wait for App Root to load (onboarding should be bypassed)
  console.log('Waiting for app root to load...');
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 });

  // Capture Dashboard Screenshot
  console.log('Capturing dashboard screen...');
  await page.screenshot({ path: 'artifacts/screenshots/live_dashboard.png' });

  // 4. Click AI Workspace navigation button
  console.log('Navigating to AI Workspace...');
  await page.click('button:has-text("AI WORKSPACE")', { force: true });
  await page.waitForTimeout(2000); // Wait for tab switch

  // Capture AI Workspace Initial Screen
  console.log('Capturing AI workspace initial screen...');
  await page.screenshot({ path: 'artifacts/screenshots/live_ai_workspace.png' });

  // Launch AI Tutor session by clicking the tutor assistant button
  console.log('Starting AI Tutor session...');
  await page.click('button:has-text("🎓 AI Tutor")', { force: true });
  await page.waitForTimeout(1000);

  // Fill in the prompt
  console.log('Submitting prompt: Explain OOP in Java...');
  const inputPlaceholder = 'Ask 🎓 AI Tutor anything...';
  await page.fill(`input[placeholder="${inputPlaceholder}"]`, 'Explain OOP in Java');
  
  // Click submit (ASK button)
  await page.click('button:has-text("ASK")', { force: true });

  // Wait for typing indicator to disappear or response to arrive
  console.log('Waiting for AI response...');
  await page.waitForTimeout(12000); // 12s wait for API response

  // Capture AI response screen
  console.log('Capturing AI response screen...');
  await page.screenshot({ path: 'artifacts/screenshots/live_ai_response.png' });

  // Save the text content of the AI chat window for audit logs
  const chatMessages = await page.locator('.glass-panel').nth(1).innerText().catch(() => '');
  await fs.promises.writeFile('artifacts/ai_verification_log.txt', chatMessages);
  console.log('AI Chat Log saved to artifacts/ai_verification_log.txt');

  // 5. Click Settings tab (which maps to ProfilePage)
  console.log('Navigating to Profile Settings...');
  await page.click('button:has-text("SETTINGS")', { force: true });
  await page.waitForTimeout(2000);

  // Capture Profile Screenshot
  console.log('Capturing profile screen...');
  await page.screenshot({ path: 'artifacts/screenshots/live_profile.png' });

  console.log('All screenshots captured successfully.');
});
