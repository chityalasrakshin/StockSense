import { expect, test, type Locator } from '@playwright/test';

/**
 * A deliberately paced, OBS-ready demo. This spec mutates the seeded data, so
 * reset/reseed the demo database before recording another take.
 */
test.use({
  baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  viewport: { width: 1920, height: 1080 },
  channel: 'chrome',
  headless: false,
});

test.describe('StockSense jury demo', () => {
  test.setTimeout(300_000);

  test('records the seeded inventory lifecycle', async ({ page }) => {
    const pause = (ms = 1_800) => page.waitForTimeout(ms);

    const type = async (field: Locator, value: string) => {
      await field.scrollIntoViewIfNeeded();
      await field.click();
      await field.fill('');
      await field.pressSequentially(value, { delay: 45 });
      await pause();
    };

    const choose = async (trigger: Locator, name: RegExp) => {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await pause();
      await page.getByRole('option', { name }).first().click();
      await pause();
    };

    const navigate = async (href: string) => {
      await page.locator(`a[href="${href}"]`).first().click();
      await page.waitForURL(`**${href}`);
      await expect(page.locator('main')).toBeVisible();
      await pause();
    };

    const createAndValidate = async () => {
      await page.locator('#btn-next-header').click();
      await pause();
      await expect(page.getByText('Product Lines')).toBeVisible();

      await choose(page.locator('#add-product'), /Steel Rods/i);
      await type(page.locator('#add-qty'), '100');
      await page.getByRole('button', { name: /add line/i }).click();
      await pause();
      await page.locator('#btn-next-lines').click();
      await pause(2_000);

      await page.locator('#btn-create-document').click();
      await expect(page.locator('#btn-validate-document')).toBeVisible();
      await pause(2_000);
      await page.locator('#btn-validate-document').click();
      await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
      await pause(2_000);
    };

    // 1. Log in as the seeded INVENTORY_MANAGER.
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'StockSense' })).toBeVisible();
    await pause();
    await type(page.locator('#email'), 'manager@stocksense.dev');
    await type(page.locator('#password'), 'password123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL('**/dashboard/overview');
    await pause();

    // 2. Keep the dashboard KPIs visible for the opening shot.
    const kpis = page.locator('section[aria-label="Core Operational KPIs"]');
    await expect(kpis).toBeVisible();
    await page.waitForTimeout(3_000);

    // 3. Receipts > New: Steel Rods, 100, seeded vendor, Main Warehouse.
    await navigate('/dashboard/receipts');
    await expect(page.getByRole('heading', { name: 'Receive Products' })).toBeVisible();
    await choose(page.locator('#destLocation'), /Main Warehouse/i);
    await type(page.locator('#contact'), 'Vandertramp Steels Ltd.');
    await type(page.locator('#partnerRef'), 'JURY-REC-STEEL-100');
    await page.locator('#btn-next-header').click();
    await pause();
    await choose(page.locator('#add-product'), /Steel Rods/i);
    await type(page.locator('#add-qty'), '100');
    await type(page.locator('#add-actual-qty'), '100');
    await page.getByRole('button', { name: /add line/i }).click();
    await pause();
    await page.locator('#btn-next-lines').click();
    await pause(2_000);
    await page.locator('#btn-create-document').click();
    await expect(page.locator('#btn-validate-document')).toBeVisible();
    await pause(2_000);
    await page.locator('#btn-validate-document').click();
    await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
    await pause(2_000);

    // 4. Transfers > New: Main Warehouse to Production Rack.
    await navigate('/dashboard/transfers');
    await expect(page.getByRole('heading', { name: 'Transfer Stock' })).toBeVisible();
    await choose(page.locator('#sourceLocation'), /Main Warehouse/i);
    await choose(page.locator('#destLocation'), /Production Rack/i);
    await type(page.locator('#partnerRef'), 'JURY-TRF-STEEL-100');
    await createAndValidate();

    // 5. Deliveries > New: deliver 20 Steel Rods from Production Rack.
    await navigate('/dashboard/deliveries');
    await expect(page.getByRole('heading', { name: 'Ship Products' })).toBeVisible();
    await choose(page.locator('#sourceLocation'), /Production Rack/i);
    await type(page.locator('#contact'), 'Azure Interior');
    await type(page.locator('#partnerRef'), 'JURY-DEL-STEEL-20');
    await page.locator('#btn-next-header').click();
    await pause();
    await choose(page.locator('#add-product'), /Steel Rods/i);
    await type(page.locator('#add-qty'), '20');
    await page.getByRole('button', { name: /add line/i }).click();
    await pause();
    await page.locator('#btn-next-lines').click();
    await pause(2_000);
    await page.locator('#btn-create-document').click();
    await expect(page.locator('#btn-validate-document')).toBeVisible();
    await pause(2_000);
    await page.locator('#btn-validate-document').click();
    await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
    await pause(2_000);

    // 6. Adjustments > New: clean seeded state leaves 110 at Production Rack;
    // enter 107 so the backend posts the requested -3 damaged-stock delta.
    await navigate('/dashboard/adjustments');
    await expect(page.getByRole('heading', { name: 'Physical Stock Reconciliation' })).toBeVisible();
    await choose(page.locator('#adjLocation'), /Production Rack/i);
    await type(page.locator('#partnerRef'), 'JURY-ADJ-DAMAGED-3');
    await page.locator('#btn-next-header').click();
    await pause();
    await choose(page.locator('#add-product'), /Steel Rods/i);
    await type(page.locator('#add-qty'), '110');
    await type(page.locator('#add-counted-qty'), '107');
    await page.getByRole('button', { name: /add line/i }).click();
    await expect(page.getByText('-3', { exact: true })).toBeVisible();
    await pause(2_000);
    await page.locator('#btn-next-lines').click();
    await pause(2_000);
    await page.locator('#btn-create-document').click();
    await expect(page.locator('#btn-validate-document')).toBeVisible();
    await pause(2_000);
    await page.locator('#btn-validate-document').click();
    await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
    await pause(2_000);

    // 7. Show the filtered audit trail. A transfer is correctly represented by
    // two physical ledger rows, alongside the other three document types.
    await navigate('/dashboard/move-history');
    await type(page.locator('#ledger-filter-product'), 'Steel Rods');
    await expect.poll(() => page.locator('table tbody tr').count()).toBeGreaterThanOrEqual(5);
    await page.waitForTimeout(5_000);

    // 8. Close on the refreshed dashboard KPIs.
    await navigate('/dashboard/overview');
    await expect(kpis).toBeVisible();
    await page.waitForTimeout(5_000);
  });
});
