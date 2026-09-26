# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo\jury-demo.spec.ts >> StockSense jury demo >> records the seeded inventory lifecycle
- Location: tests\demo\jury-demo.spec.ts:17:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'StockSense' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'StockSense' }) with timeout 15000ms
  - waiting for getByRole('heading', { name: 'StockSense' })

```

```yaml
- region "Notifications alt+T"
- text: StockSense Enter your credentials to access the Inventory Management System Email
- textbox "Email":
  - /placeholder: name@company.com
  - text: manager@stocksense.dev
- text: Password
- link "Forgot password?":
  - /url: /forgot-password
- textbox "Password":
  - /placeholder: ••••••••
  - text: password123
- button "Sign In"
- paragraph: "Quick Demo Accounts:"
- button "Manager (Full Access)"
- button "Staff (Operations Only)"
- text: Don't have an account?
- link "Sign up":
  - /url: /signup
- button "Open Tanstack query devtools":
  - img
- alert
```

# Test source

```ts
  1   | import { expect, test, type Locator } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * A deliberately paced, OBS-ready demo. This spec mutates the seeded data, so
  5   |  * reset/reseed the demo database before recording another take.
  6   |  */
  7   | test.use({
  8   |   baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  9   |   viewport: { width: 1920, height: 1080 },
  10  |   channel: 'chrome',
  11  |   headless: false,
  12  | });
  13  | 
  14  | test.describe('StockSense jury demo', () => {
  15  |   test.setTimeout(300_000);
  16  | 
  17  |   test('records the seeded inventory lifecycle', async ({ page }) => {
  18  |     const pause = (ms = 1_800) => page.waitForTimeout(ms);
  19  | 
  20  |     const type = async (field: Locator, value: string) => {
  21  |       await field.scrollIntoViewIfNeeded();
  22  |       await field.click();
  23  |       await field.fill('');
  24  |       await field.pressSequentially(value, { delay: 45 });
  25  |       await pause();
  26  |     };
  27  | 
  28  |     const choose = async (trigger: Locator, name: RegExp) => {
  29  |       await trigger.scrollIntoViewIfNeeded();
  30  |       await trigger.click();
  31  |       await pause();
  32  |       await page.getByRole('option', { name }).first().click();
  33  |       await pause();
  34  |     };
  35  | 
  36  |     const navigate = async (href: string) => {
  37  |       await page.locator(`a[href="${href}"]`).first().click();
  38  |       await page.waitForURL(`**${href}`);
  39  |       await expect(page.locator('main')).toBeVisible();
  40  |       await pause();
  41  |     };
  42  | 
  43  |     const createAndValidate = async () => {
  44  |       await page.locator('#btn-next-header').click();
  45  |       await pause();
  46  |       await expect(page.getByText('Product Lines')).toBeVisible();
  47  | 
  48  |       await choose(page.locator('#add-product'), /Steel Rods/i);
  49  |       await type(page.locator('#add-qty'), '100');
  50  |       await page.getByRole('button', { name: /add line/i }).click();
  51  |       await pause();
  52  |       await page.locator('#btn-next-lines').click();
  53  |       await pause(2_000);
  54  | 
  55  |       await page.locator('#btn-create-document').click();
  56  |       await expect(page.locator('#btn-validate-document')).toBeVisible();
  57  |       await pause(2_000);
  58  |       await page.locator('#btn-validate-document').click();
  59  |       await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
  60  |       await pause(2_000);
  61  |     };
  62  | 
  63  |     // 1. Log in as the seeded INVENTORY_MANAGER.
  64  |     await page.goto('/login');
> 65  |     await expect(page.getByRole('heading', { name: 'StockSense' })).toBeVisible();
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  66  |     await pause();
  67  |     await type(page.locator('#email'), 'manager@stocksense.dev');
  68  |     await type(page.locator('#password'), 'password123');
  69  |     await page.getByRole('button', { name: /^sign in$/i }).click();
  70  |     await page.waitForURL('**/dashboard/overview');
  71  |     await pause();
  72  | 
  73  |     // 2. Keep the dashboard KPIs visible for the opening shot.
  74  |     const kpis = page.locator('section[aria-label="Core Operational KPIs"]');
  75  |     await expect(kpis).toBeVisible();
  76  |     await page.waitForTimeout(3_000);
  77  | 
  78  |     // 3. Receipts > New: Steel Rods, 100, seeded vendor, Main Warehouse.
  79  |     await navigate('/dashboard/receipts');
  80  |     await expect(page.getByRole('heading', { name: 'Receive Products' })).toBeVisible();
  81  |     await choose(page.locator('#destLocation'), /Main Warehouse/i);
  82  |     await type(page.locator('#contact'), 'Vandertramp Steels Ltd.');
  83  |     await type(page.locator('#partnerRef'), 'JURY-REC-STEEL-100');
  84  |     await page.locator('#btn-next-header').click();
  85  |     await pause();
  86  |     await choose(page.locator('#add-product'), /Steel Rods/i);
  87  |     await type(page.locator('#add-qty'), '100');
  88  |     await type(page.locator('#add-actual-qty'), '100');
  89  |     await page.getByRole('button', { name: /add line/i }).click();
  90  |     await pause();
  91  |     await page.locator('#btn-next-lines').click();
  92  |     await pause(2_000);
  93  |     await page.locator('#btn-create-document').click();
  94  |     await expect(page.locator('#btn-validate-document')).toBeVisible();
  95  |     await pause(2_000);
  96  |     await page.locator('#btn-validate-document').click();
  97  |     await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
  98  |     await pause(2_000);
  99  | 
  100 |     // 4. Transfers > New: Main Warehouse to Production Rack.
  101 |     await navigate('/dashboard/transfers');
  102 |     await expect(page.getByRole('heading', { name: 'Transfer Stock' })).toBeVisible();
  103 |     await choose(page.locator('#sourceLocation'), /Main Warehouse/i);
  104 |     await choose(page.locator('#destLocation'), /Production Rack/i);
  105 |     await type(page.locator('#partnerRef'), 'JURY-TRF-STEEL-100');
  106 |     await createAndValidate();
  107 | 
  108 |     // 5. Deliveries > New: deliver 20 Steel Rods from Production Rack.
  109 |     await navigate('/dashboard/deliveries');
  110 |     await expect(page.getByRole('heading', { name: 'Ship Products' })).toBeVisible();
  111 |     await choose(page.locator('#sourceLocation'), /Production Rack/i);
  112 |     await type(page.locator('#contact'), 'Azure Interior');
  113 |     await type(page.locator('#partnerRef'), 'JURY-DEL-STEEL-20');
  114 |     await page.locator('#btn-next-header').click();
  115 |     await pause();
  116 |     await choose(page.locator('#add-product'), /Steel Rods/i);
  117 |     await type(page.locator('#add-qty'), '20');
  118 |     await page.getByRole('button', { name: /add line/i }).click();
  119 |     await pause();
  120 |     await page.locator('#btn-next-lines').click();
  121 |     await pause(2_000);
  122 |     await page.locator('#btn-create-document').click();
  123 |     await expect(page.locator('#btn-validate-document')).toBeVisible();
  124 |     await pause(2_000);
  125 |     await page.locator('#btn-validate-document').click();
  126 |     await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
  127 |     await pause(2_000);
  128 | 
  129 |     // 6. Adjustments > New: clean seeded state leaves 110 at Production Rack;
  130 |     // enter 107 so the backend posts the requested -3 damaged-stock delta.
  131 |     await navigate('/dashboard/adjustments');
  132 |     await expect(page.getByRole('heading', { name: 'Physical Stock Reconciliation' })).toBeVisible();
  133 |     await choose(page.locator('#adjLocation'), /Production Rack/i);
  134 |     await type(page.locator('#partnerRef'), 'JURY-ADJ-DAMAGED-3');
  135 |     await page.locator('#btn-next-header').click();
  136 |     await pause();
  137 |     await choose(page.locator('#add-product'), /Steel Rods/i);
  138 |     await type(page.locator('#add-qty'), '110');
  139 |     await type(page.locator('#add-counted-qty'), '107');
  140 |     await page.getByRole('button', { name: /add line/i }).click();
  141 |     await expect(page.getByText('-3', { exact: true })).toBeVisible();
  142 |     await pause(2_000);
  143 |     await page.locator('#btn-next-lines').click();
  144 |     await pause(2_000);
  145 |     await page.locator('#btn-create-document').click();
  146 |     await expect(page.locator('#btn-validate-document')).toBeVisible();
  147 |     await pause(2_000);
  148 |     await page.locator('#btn-validate-document').click();
  149 |     await expect(page.getByText(/validated.*stock ledger/i)).toBeVisible();
  150 |     await pause(2_000);
  151 | 
  152 |     // 7. Show the filtered audit trail. A transfer is correctly represented by
  153 |     // two physical ledger rows, alongside the other three document types.
  154 |     await navigate('/dashboard/move-history');
  155 |     await type(page.locator('#ledger-filter-product'), 'Steel Rods');
  156 |     await expect.poll(() => page.locator('table tbody tr').count()).toBeGreaterThanOrEqual(5);
  157 |     await page.waitForTimeout(5_000);
  158 | 
  159 |     // 8. Close on the refreshed dashboard KPIs.
  160 |     await navigate('/dashboard/overview');
  161 |     await expect(kpis).toBeVisible();
  162 |     await page.waitForTimeout(5_000);
  163 |   });
  164 | });
  165 | 
```