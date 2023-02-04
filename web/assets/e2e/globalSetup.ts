import { chromium, FullConfig } from '@playwright/test';

export default async function(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4010/users/log_in');

  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('testpassword');
  await page.getByLabel('Password').press('Enter');

  if (!await page.getByText('Log out').isVisible()) {
    throw new Error('Login failed');
  }

  await page.context().storageState({ path: 'e2e/userStorageState.json' });
  await browser.close();
}
