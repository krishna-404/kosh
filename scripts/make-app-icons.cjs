// Renders the Kosh mark (three coins, sunshine on Kosh green) to the icons the
// app shell needs: favicons, the home-screen icons, the maskable icon and the
// notification icon and badge. Run it after changing the mark or its colours:
//
//   node scripts/make-app-icons.cjs apps/frontend/public
//
// Needs Playwright's Chromium (the same one the e2e tests use). The colours
// are the `accent` and `sun` tokens of packages/ui-mui/src/theme/tokens.ts.
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const GREEN = '#0B7A63', SUN = '#F7C548';
// The mark's coins on a 24-unit grid, as in KoshMark.tsx.
const coins = `<rect x="3.5" y="15" width="17" height="4.5" rx="2.25"/><rect x="6" y="9.25" width="12" height="4.5" rx="2.25"/><rect x="8.5" y="3.5" width="7" height="4.5" rx="2.25"/>`;
const svg = (size, { radius, scale }) => {
  const mark = size * scale, offset = (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * radius}" fill="${GREEN}"/>
    <g transform="translate(${offset} ${offset}) scale(${mark / 24})" fill="${SUN}">${coins}</g></svg>`;
};
const files = [
  ['favicon-16x16.png', 16, { radius: 0.22, scale: 0.66 }],
  ['favicon-32x32.png', 32, { radius: 0.24, scale: 0.62 }],
  ['apple-touch-icon.png', 180, { radius: 0, scale: 0.56 }],          // iOS rounds it itself
  ['android-chrome-192x192.png', 192, { radius: 0.24, scale: 0.58 }],
  ['android-chrome-512x512.png', 512, { radius: 0.24, scale: 0.58 }],
  ['maskable-icon-512x512.png', 512, { radius: 0, scale: 0.46 }],     // full bleed; mark inside the safe zone
  ['notification-icon-192x192.png', 192, { radius: 0.24, scale: 0.58 }],
];
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [name, size, shape] of files) {
    const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage();
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, shape)}</body></html>`);
    await page.screenshot({ path: `${out}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.context().close();
  }
  // A monochrome badge for Android's status bar: white coins on transparent.
  {
    const size = 96;
    const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage();
    await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="#fff">${coins}</svg></body></html>`);
    await page.screenshot({ path: `${out}/notification-badge-96x96.png`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.context().close();
  }
  await browser.close();
  // favicon.ico: one 32px PNG inside an ICO wrapper.
  const png = fs.readFileSync(`${out}/favicon-32x32.png`);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync(`${out}/favicon.ico`, Buffer.concat([header, png]));
  console.log(fs.readdirSync(out).join(' '));
})().catch(e => { console.error(e); process.exit(1); });
