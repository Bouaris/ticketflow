/**
 * E2E Tests - Application Smoke Tests
 *
 * Basic tests to verify the application loads and critical features work.
 * These tests run against the web version (not Tauri desktop app).
 */

import { test, expect } from '@playwright/test';

test.describe('Application Loading', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Check that the page has loaded something
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display welcome screen or header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should see either the welcome screen title or the app header
    const welcomeTitle = page.getByText('Bienvenue');
    const ticketflowTitle = page.getByText('Ticketflow');
    const header = page.locator('header');

    // At least one should be visible
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);
    const hasTicketflow = await ticketflowTitle.isVisible().catch(() => false);
    const hasHeader = await header.isVisible().catch(() => false);

    expect(hasWelcome || hasTicketflow || hasHeader).toBe(true);
  });

  test('should have settings button accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for a settings button (gear icon button)
    const settingsButton = page.locator('button[title="Paramètres"]');

    // If the settings button exists and is visible
    if (await settingsButton.isVisible().catch(() => false)) {
      await settingsButton.click();

      // Should open settings modal
      const settingsModal = page.getByRole('dialog');
      await expect(settingsModal).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('File System Warning', () => {
  test('should show browser warning if File System API not supported', async ({ page, browserName }) => {
    // Skip this test on Chromium-based browsers (they support the API)
    test.skip(browserName === 'chromium', 'Chromium supports File System API');

    await page.goto('/');

    // Should see a warning about browser support
    const warning = page.getByText(/navigateur non supporté|Chrome ou Edge/i);
    await expect(warning).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have no accessibility violations on initial load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Basic accessibility checks
    // All images should have alt text
    const images = page.locator('img:not([alt])');
    const imagesWithoutAlt = await images.count();
    expect(imagesWithoutAlt).toBe(0);

    // All buttons should have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasAccessibleName = await button.evaluate((el) => {
        return !!(el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('title'));
      });
      expect(hasAccessibleName).toBe(true);
    }
  });
});
