const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  // Wait a bit for the drop animation to settle
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/scripts/hallpass-1.png', fullPage: false });
  // Scroll to ensure hero is visible
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  // Take a focused screenshot of just the hero area
  const hero = await page.$('.hero');
  if (hero) {
    await hero.screenshot({ path: '/home/z/my-project/scripts/hallpass-hero.png' });
  }
  // Click the card to flip it
  const card = await page.$('.hp-card');
  if (card) {
    await card.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/z/my-project/scripts/hallpass-flipped.png', fullPage: false });
  }
  await browser.close();
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
