import { test, expect, type Page } from '@playwright/test';

/**
 * Golden-path E2E smoke test covering: menu -> garage vehicle selection ->
 * play setup -> starting a race -> live HUD/physics -> pause/quit -> reload
 * persistence. It intentionally stops short of literally driving a full lap
 * to the finish line: doing that with real-time keyboard input in headless
 * Chromium would make the suite slow and flaky (checkpoint navigation
 * depends on precise steering). Full lap/finish/reward logic is instead
 * covered deterministically by tests/integration/raceManager.test.ts and the
 * achievement/reward unit tests.
 */

async function clearProfile(page: Page): Promise<void> {
  // Deliberately not addInitScript: that would re-run (and wipe storage) on
  // every subsequent navigation, including the reload we use later in this
  // test to verify persistence. Clear once, then reload to start fresh.
  await page.evaluate(() => {
    window.localStorage.removeItem('vi-profile-v1');
    window.localStorage.removeItem('vi-auth-v1');
  });
  await page.reload();
}

function readProfile(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('vi-profile-v1');
    return raw ? JSON.parse(raw) : null;
  });
}

async function goBack(page: Page): Promise<void> {
  const backBtn = page.locator('.vi-panel-header button');
  await backBtn.scrollIntoViewIfNeeded();
  await backBtn.click();
}

test.describe('Velocity Island golden path', () => {
  test('registration, garage selection, race start, and reload persistence', async ({ page }) => {
    await page.goto('/');
    await clearProfile(page);

    await expect(page.locator('.vi-menu-nav button').first()).toBeVisible();
    const navButtons = page.locator('.vi-menu-nav button');
    await expect(navButtons).toHaveCount(7);

    // --- Registration: create a real account through the Settings screen ---
    await navButtons.nth(6).click(); // Settings
    const email = `e2e-${Date.now()}@velocityisland.test`;
    const displayName = `E2E${Date.now() % 100000}`;
    const accountInputs = page.locator('.vi-settings-section').first().locator('input');
    await accountInputs.nth(0).fill(email); // email
    await accountInputs.nth(1).fill('correcthorsebatterystaple'); // password
    await accountInputs.nth(2).fill(displayName); // display name
    const createAccountBtn = page.getByRole('button', { name: /Save Account|حفظ الحساب/ });
    await createAccountBtn.click();
    await expect(page.locator('.vi-settings-section').first()).toContainText(displayName, { timeout: 15_000 });

    const authSession = await page.evaluate(() => window.localStorage.getItem('vi-auth-v1'));
    expect(authSession).toBeTruthy();
    expect(JSON.parse(authSession!).isGuest).toBe(false);
    expect(JSON.parse(authSession!).displayName).toBe(displayName);

    await goBack(page); // back to main menu

    // --- Garage: select a specific (unlocked) vehicle + colorway ---
    await navButtons.nth(1).click(); // Garage
    const prevBtn = page.locator('.vi-row--spread button').first();
    await expect(page.locator('canvas').last()).toBeVisible();
    // Default selection is "wave" (index 2 of the roster); step back twice to
    // reach "toro" (index 0), which is also unlocked by default.
    await prevBtn.click();
    await prevBtn.click();

    const colorwaySwatches = page.locator('.vi-colorway-swatch');
    await expect(colorwaySwatches.first()).toBeVisible();
    if ((await colorwaySwatches.count()) > 1) {
      await colorwaySwatches.nth(1).click();
    }

    const selectBtn = page.locator('button.vi-btn--accent');
    await expect(selectBtn).toBeEnabled();
    const beforeSelectText = await selectBtn.textContent();
    await selectBtn.click();
    await expect(selectBtn).not.toHaveText(beforeSelectText ?? '');

    const profileAfterSelect = await readProfile(page);
    expect(profileAfterSelect.selectedVehicleId).toBe('toro');

    await goBack(page); // back to main menu

    // --- Play setup: pick a track, reduce laps/bots, start the race ---
    await navButtons.nth(0).click(); // Play
    const trackCards = page.locator('.vi-option-grid').first().locator('.vi-option-card');
    await expect(trackCards.first()).toBeVisible();
    await trackCards.nth(1).click();

    const lapsMinus = page.locator('.vi-stepper__btn', { hasText: '−' }).first();
    await lapsMinus.click();
    await lapsMinus.click(); // laps: 3 -> 1

    const botsMinus = page.locator('.vi-stepper__btn', { hasText: '−' }).nth(1);
    for (let i = 0; i < 7; i++) await botsMinus.click(); // bots: 7 -> 0

    await page.getByRole('button', { name: /START RACE|ابدأ السباق/ }).click();

    // --- Live race: HUD becomes visible and physics respond to input ---
    await expect(page.locator('.vi-hud')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.vi-hud-speed__number')).toBeVisible({ timeout: 15_000 });

    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2000);
    const speedText = await page.locator('.vi-hud-speed__number').textContent();
    await page.keyboard.up('ArrowUp');
    expect(Number(speedText)).toBeGreaterThan(0);

    // --- Pause / quit back to the main menu ---
    await page.keyboard.press('Escape');
    await expect(page.locator('.vi-panel-title')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /QUIT TO MENU|الخروج للقائمة/ }).click();
    await expect(page.locator('.vi-menu-nav button').first()).toBeVisible();

    // --- Reload: garage/profile selection must persist across a full reload ---
    await page.reload();
    const profileAfterReload = await readProfile(page);
    expect(profileAfterReload.selectedVehicleId).toBe('toro');

    const sessionAfterReload = await page.evaluate(() => window.localStorage.getItem('vi-auth-v1'));
    expect(sessionAfterReload).toBeTruthy();
    expect(JSON.parse(sessionAfterReload!).isGuest).toBe(false);
    expect(JSON.parse(sessionAfterReload!).displayName).toBe(displayName);
  });
});
