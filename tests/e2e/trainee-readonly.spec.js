const { test, expect } = require('@playwright/test');
const { loginAsTrainee, logout } = require('./helpers/login');

const allowedTraineePages = [
  '/timeline',
  '/reports',
  '/grades',
  '/profile'
];

const forbiddenPages = [
  '/admin/dashboard',
  '/admin/users',
  '/dio/dashboard',
  '/dio/trainees',
  '/president/trainees',
  '/program-director/trainees',
  '/secretary/trainees',
  '/supervisor/trainees'
];

test.describe('MTMS production read-only trainee access', () => {
  test('trainee login, navigation, protected routes, and logout', async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];
    let checkingForbiddenRoute = false;

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'request failed'}`);
    });

    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && !(checkingForbiddenRoute && [401, 403, 404].includes(status))) {
        failedRequests.push(`${status} ${url}`);
      }
    });

    await loginAsTrainee(page);

    for (const route of allowedTraineePages) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
      await expect(page.locator('body')).toBeVisible();
    }

    for (const route of forbiddenPages) {
      checkingForbiddenRoute = true;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      checkingForbiddenRoute = false;

      await expect(page).not.toHaveURL(new RegExp(route.replace('/', '\\/')));
      await expect(page).toHaveURL(/\/timeline|\/reports|\/grades|\/profile/);
    }

    await logout(page);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    expect(failedRequests, `Failed network requests:\n${failedRequests.join('\n')}`).toEqual([]);
  });
});
