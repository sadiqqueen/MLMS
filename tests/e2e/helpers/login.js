const { expect } = require('@playwright/test');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function openLoginPanel(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const portalLogin = page.getByRole('button', { name: /portal login|login to portal|login/i }).first();
  if (await portalLogin.isVisible().catch(() => false)) {
    await portalLogin.click();
  }

  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
}

async function loginAsTrainee(page) {
  const email = requiredEnv('MTMS_TRAINEE_EMAIL');
  const password = requiredEnv('MTMS_TRAINEE_PASSWORD');

  await openLoginPanel(page);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const loginButton = page.getByRole('button', { name: /^login$|portal login|sign in/i }).last();
  await Promise.all([
    page.waitForURL(url => !['/', '/landing.html'].includes(url.pathname), { timeout: 30_000 }),
    loginButton.click()
  ]);

  await expect(page).toHaveURL(/\/timeline|\/reports|\/grades|\/profile/);
}

async function logout(page) {
  const profileButton = page.locator('.profile-dropdown, .profile-trigger, [aria-label*="profile" i]').first();
  if (await profileButton.isVisible().catch(() => false)) {
    await profileButton.click();
  }

  const logoutButton = page.getByRole('button', { name: /logout|log out/i }).first();
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  } else {
    throw new Error('Logout button was not found in the visible profile/user menu.');
  }

  await expect(page).toHaveURL(/\/$|\/landing\.html/);
}

module.exports = {
  loginAsTrainee,
  logout
};
