import { test, expect } from '@playwright/test'

// Требует локальный backend на :8010 (см. память oinarri-local-dev-environment,
// сид-аккаунт founder/test1234).
test('founder can log in and reach the dashboard', async ({ page }) => {
  await page.goto('/')
  // Логин/пароль readOnly до pointerdown (iOS-хак под системную клавиатуру,
  // см. LoginPage.tsx) — .fill() без предварительного .click() не снимает readOnly.
  await page.locator('#login').click()
  await page.locator('#login').fill('founder')
  await page.locator('#password').click()
  await page.locator('#password').fill('test1234')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page).not.toHaveURL(/login/i)
})
