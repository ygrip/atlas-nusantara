import { test as base } from '@playwright/test';

export * from '@playwright/test';

/** UI checks must not generate real Google ad impressions. Specific ad tests can override this route. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js*', route => route.fulfill({
      contentType: 'application/javascript',
      body: `window.adsbygoogle = { push: function () {
        window.__testAdRequests = (window.__testAdRequests || 0) + 1;
        const slot = document.querySelector('ins[data-ad-slot]');
        if (slot) slot.dataset.adStatus = 'filled';
      } };`
    }));
    await use(page);
  }
});
