import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve(process.cwd(), 'src/assets/manual');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function captureAll() {
  console.log('[Script] Starting Puppeteer to capture Mobile Phone screenshots...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  // Emulate iPhone 14 Pro mobile viewport (390 x 844, DPR 2)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const BASE_URL = 'https://team-taraba-river.web.app';

  console.log(`[Script] Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Screenshot of Login Gate
  console.log('[1/10] Capturing Login Gate...');
  await page.screenshot({
    path: path.join(OUT_DIR, '01_login_gate.png'),
  });

  // 2. Perform Login with verified member credential (07032911647)
  console.log('[Script] Entering member credential in mobile view...');
  const inputSelector = 'input[type="text"]';
  await page.waitForSelector(inputSelector);
  await page.type(inputSelector, '07032911647');
  await new Promise((r) => setTimeout(r, 500));

  // Click Sign In button
  const signInButton = await page.$('button[type="submit"]');
  if (signInButton) {
    await signInButton.click();
    console.log('[Script] Clicked Sign In button, waiting for transition...');
  }
  await new Promise((r) => setTimeout(r, 3000));

  // 2. Screenshot of Home & Events
  console.log('[2/10] Capturing Home & Events Feed...');
  await page.screenshot({
    path: path.join(OUT_DIR, '02_home_events.png'),
  });

  // 3. Scroll down to capture USOSA News & Birthday Celebrants
  console.log('[3/10] Capturing USOSA News & Audio Reader...');
  await page.evaluate(() => {
    window.scrollBy({ top: 500, behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(OUT_DIR, '03_news_reader.png'),
  });

  // 4. Scroll to Birthdays
  console.log('[4/10] Capturing Birthday Celebrants Hub...');
  await page.evaluate(() => {
    window.scrollBy({ top: 600, behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({
    path: path.join(OUT_DIR, '04_birthdays.png'),
  });

  // 5. Scroll back up and click AI Xplora if available
  console.log('[5/10] Capturing AI Xplora Assistant...');
  const aiButton = await page.$('button[title*="AI"], button:has(svg)');
  // We can also evaluate setting tab or opening AI
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 800));

  // 6. Navigate to Media Tab
  console.log('[6/10] Capturing Event Media Gallery...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const mediaBtn = btns.find((b) => b.textContent?.includes('Media') || b.getAttribute('aria-label')?.includes('Media'));
    if (mediaBtn) mediaBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: path.join(OUT_DIR, '05_media_gallery.png'),
  });

  // 7. Click Update / Add Media to show Upload progress
  console.log('[7/10] Capturing Media Upload UI...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const uploadBtn = btns.find((b) => b.textContent?.includes('Update / Add Media') || b.textContent?.includes('Upload'));
    if (uploadBtn) uploadBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: path.join(OUT_DIR, '06_media_upload.png'),
  });

  // 8. Close Upload modal or return, then open Member Directory / My Profile
  console.log('[8/10] Capturing My Profile View...');
  await page.evaluate(() => {
    const cancelOrReturn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Cancel') || b.textContent?.includes('Return') || b.textContent?.includes('Back')
    );
    if (cancelOrReturn) cancelOrReturn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Open User Dropdown Menu
  await page.evaluate(() => {
    const avatarBtn = document.querySelector('header button');
    if (avatarBtn) (avatarBtn as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click My Profile
  await page.evaluate(() => {
    const profileBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('My Profile'));
    if (profileBtn) profileBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: path.join(OUT_DIR, '07_my_profile.png'),
  });

  // 9. Login as Admin by setting localStorage and capture Admin Portal
  console.log('[9/10] Setting Admin Session to capture Admin Dashboard...');
  await page.evaluate(() => {
    const adminUser = {
      id: 'mem_admin_1',
      fullName: 'Executive Administrator',
      firstName: 'Admin',
      surname: 'Executive',
      email: 'tarabateam@gmail.com',
      phoneNumber: '08030000000',
      role: 'admin',
      title: 'Admin',
      photoStatus: 'approved',
    };
    localStorage.setItem('taraba_river_user_v1', JSON.stringify(adminUser));
    window.location.reload();
  });
  await new Promise((r) => setTimeout(r, 3000));

  // Navigate to Admin Tab
  await page.evaluate(() => {
    const adminBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Admin'));
    if (adminBtn) adminBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  console.log('[10/10] Capturing Admin Dashboard & Moderation...');
  await page.screenshot({
    path: path.join(OUT_DIR, '08_admin_dashboard.png'),
  });

  await browser.close();
  console.log('[Script] ✅ All mobile screenshots captured successfully in src/assets/manual/!');
}

captureAll().catch((err) => {
  console.error('[Script] Error capturing screenshots:', err);
  process.exit(1);
});
