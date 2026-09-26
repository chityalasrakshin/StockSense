import { test, expect } from '@playwright/test';

test.describe('StockSense Smoke Suite', () => {
  test('should load dashboard shell and sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page).toHaveTitle(/StockSense/);
    await expect(page.locator('text=StockSense')).toBeVisible();
    await expect(page.locator('text=Products')).toBeVisible();
    await expect(page.locator('text=Receipts')).toBeVisible();
  });
});
