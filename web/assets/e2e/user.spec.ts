import { test, expect } from '@playwright/test';
import {faker} from '@faker-js/faker';

test.use({ storageState: 'e2e/emptyStorageState.json' });

test('sign in', async ({ page }) => {
  await page.goto('/');

  await page.getByText('Log in').click();

  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByLabel('Password').press('Enter');

  await expect(page.getByText('Log out')).toBeVisible();
});

test('register', async ({ page }) => {
  await page.goto('/users/register');

  await page.getByLabel('Email').fill(faker.internet.email());
  await page.getByLabel('Password').fill(faker.internet.password());
  await page.getByLabel('Password').press('Enter');

  await expect(page.getByText('Log out')).toBeVisible();
});
