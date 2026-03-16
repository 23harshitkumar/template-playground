import { test, expect } from '@playwright/test';

test.describe('Logic MVP Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-spinner-container')).toBeHidden({ timeout: 30000 });
  });

  test('should initialize and trigger Counter Contract logic successfully', async ({ page }) => {
    const sampleDropdown = page.getByRole('button', { name: 'Load sample dropdown' });
    await expect(sampleDropdown).toBeVisible();
    await sampleDropdown.click();

    const logicSample = page.getByRole('menuitem', { name: 'Counter Contract (with Logic)' });
    await expect(logicSample).toBeVisible({ timeout: 10000 });
    await logicSample.click();

    await expect(page.getByText('TypeScript Logic')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Contract Execution')).toBeVisible();
    await expect(page.getByText('Execution Results')).toBeVisible();

    // Force a compile to avoid stale/non-compiled state across runs
    const applyLogicButton = page.getByRole('button', { name: /Apply Logic/i });
    await expect(applyLogicButton).toBeVisible({ timeout: 15000 });
    await applyLogicButton.click();

    const initButton = page.getByRole('button', { name: /Init Contract/i });
    await expect(initButton).toBeEnabled({ timeout: 15000 });
    await initButton.click();

    await expect(page.getByText(/State initialized/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('● Initialized')).toBeVisible({ timeout: 15000 });

    const sendRequestButton = page.getByRole('button', { name: /Send Request/i });
    await expect(sendRequestButton).toBeEnabled();
    await sendRequestButton.click();

    await expect(page.getByText(/newCount/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Alice's count is now 1/i)).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Events' }).click();
    await expect(page.getByText(/CounterUpdated/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'State' }).click();
    await expect(page.getByText('Before')).toBeVisible();
    await expect(page.getByText('After')).toBeVisible();
    await expect(page.getByText(/"count": 1/)).toBeVisible();
  });
});
