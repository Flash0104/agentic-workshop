import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page correctly', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Agentic Workshop Trainer/);

    // Check main heading
    const heading = page.getByRole('heading', { name: /Agentic Workshop Trainer/i });
    await expect(heading).toBeVisible();

    // Check configuration options are present
    await expect(page.getByText(/Start a New Session/i)).toBeVisible();
  });

  test('should show session configuration options', async ({ page }) => {
    await page.goto('/');

    // Check for scenario selector
    await expect(page.getByText(/Scenario/i)).toBeVisible();
    
    // Check for difficulty selector
    await expect(page.getByText(/Difficulty/i)).toBeVisible();
    
    // Check for language selector
    await expect(page.getByText(/Language/i)).toBeVisible();
  });

  test('should have a start session button', async ({ page }) => {
    await page.goto('/');

    const startButton = page.getByRole('button', { name: /Start Session/i });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
  });
});

// Note: Testing actual session creation requires authentication
// For full E2E tests, you'll need to:
// 1. Set up test user credentials
// 2. Mock or configure Supabase auth
// 3. Add authentication flow to tests

