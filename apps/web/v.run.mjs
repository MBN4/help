import { chromium } from '@playwright/test';
const B = 'http://localhost:3000';
const UID = '40568f11-67c4-4e97-9208-a294fa8fee03';
const sets = {
  pub: [
    null,
    [
      '/',
      '/lahore',
      '/karachi/restaurants',
      '/lahore/food-dining',
      '/business/peshawar-heritage-restaurant',
      '/search',
      '/search?q=cafe&city=lahore',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password?token=x',
      '/verify-email?token=x',
      '/privacy',
      `/reviewers/${UID}`,
      '/nope',
    ],
  ],
  cust: [
    'customer@buisnez.pk',
    ['/account', '/account/reviews', '/account/favorites', '/account/photos'],
  ],
  own: ['owner@buisnez.pk', ['/account/businesses']],
  adm: [
    'admin@buisnez.pk',
    [
      '/admin',
      '/admin/businesses',
      '/admin/claims',
      '/admin/content',
      '/admin/edit-suggestions',
      '/admin/moderation-log',
      '/admin/reports',
      '/admin/taxonomy',
      '/admin/users',
    ],
  ],
};
const only = process.argv[2];
const b = await chromium.launch();
for (const [role, [email, paths]] of Object.entries(sets)) {
  if (only && role !== only) continue;
  for (const w of [1440, 375, 320]) {
    const ctx = await b.newContext({
      viewport: { width: w, height: w > 400 ? 900 : 800 },
    });
    if (email) {
      const p = await ctx.newPage();
      await p.goto(B + '/login', { waitUntil: 'networkidle' });
      const f = p.locator('form', { has: p.locator('input[type=password]') });
      await f.locator('input[type=email]').fill(email);
      await f.locator('input[type=password]').fill('Password123!');
      await f.locator('button[type=submit]').click();
      await p.waitForTimeout(3000);
      await p.close();
    }
    for (const path of paths) {
      const p = await ctx.newPage();
      const errs = [],
        bad = [];
      p.on('console', (m) => {
        if (m.type() === 'error' && !/401|favicon/.test(m.text()))
          errs.push(m.text().slice(0, 110));
      });
      p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message.slice(0, 110)));
      p.on('response', (r) => {
        if (r.status() >= 400 && r.status() !== 401)
          bad.push(
            r.status() +
              ' ' +
              r
                .url()
                .replace(/^https?:\/\/[^/]+/, '')
                .slice(0, 60),
          );
      });
      let status = '?';
      try {
        status = (
          await p.goto(B + path, { waitUntil: 'networkidle', timeout: 60000 })
        ).status();
      } catch {
        status = 'TIMEOUT';
      }
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const off = [...document.querySelectorAll('body *')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width > 0 &&
              r.right > vw + 1 &&
              !e.closest(
                '[class*="overflow-x-auto"],[class*="overflow-hidden"],.leaflet-container',
              )
            );
          })
          .slice(0, 2)
          .map((e) => e.tagName + '.' + String(e.className).slice(0, 50));
        return {
          over: document.documentElement.scrollWidth - vw,
          off,
          broken: [...document.images].filter(
            (i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy',
          ).length,
          h1: document.querySelector('h1')?.innerText.slice(0, 40) ?? null,
        };
      });
      const flags = [
        r.over > 0 ? 'OVERFLOW' + r.over + JSON.stringify(r.off) : '',
        r.broken ? 'BROKENIMG' + r.broken : '',
        errs.length ? 'ERR:' + [...new Set(errs)].join('|') : '',
        bad.length ? 'BAD:' + [...new Set(bad)].join('|') : '',
      ].filter(Boolean);
      const expected = path === '/nope' ? 404 : 200;
      console.log(
        (flags.length || status !== expected ? '!! ' : 'ok ') +
          role +
          ' ' +
          w +
          ' ' +
          path +
          ' ' +
          status +
          (flags.length ? ' ' + flags.join(' ') : ''),
      );
      await p.close();
    }
    await ctx.close();
  }
}
await b.close();
