const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:8080/relatives', { waitUntil: 'networkidle2', timeout: 10000 });
  } catch (e) {
    console.log('Nav error:', e.message);
  }
  
  await browser.close();
})();
