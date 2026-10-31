import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop', width: 1280, height: 800 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`responsive layout: ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto('/examples-frame/browser-ui/');

    await expect(page.locator('body')).toBeVisible();

    // Check that the page has no horizontal overflow.
    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.pageWidth,
      `Horizontal overflow at ${viewport.width}px`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
}

test('mobile navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/examples-frame/browser-ui/');

  const menuButton = page.getByRole('button', {
    name: /more tools/i,
  });

  await expect(menuButton).toBeVisible();

  await expect(
    page.locator('.kb-popup').getByRole('button', {
      name: /table/i,
    }),
  ).toBeHidden();

  await menuButton.click();

  await expect(
    page.locator('.kb-popup').getByRole('button', {
      name: /table/i,
    }),
  ).toBeVisible();
});

// test('homepage looks correct on mobile', async ({ page, baseURL }) => {
//   await page.goto('/examples-frame/browser-ui/');
//   await page.setViewportSize({ width: 375, height: 812 });
//
//   await expect(page).toHaveScreenshot('homepage-mobile.png', {
//     fullPage: true,
//   });
// });
