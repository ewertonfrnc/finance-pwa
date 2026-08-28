import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import { createLocalStartingPositionFixture } from './support/finance-admin'

const password = 'local-password-123'

let email: string
let userId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  userId = ''
  email = `auth-login-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
  const user = await createLocalAuthUser({ email, password })
  userId = user.id
  await createLocalStartingPositionFixture({
    balance_cents: 5000,
    effective_on: '2026-08-27',
    user_id: userId,
  })
})

test.afterEach(async () => {
  if (userId) await deleteLocalAuthUser(userId)
})

test('should protect the app, restore login, reject external redirects, and log out', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const verificationWindow = window as Window & {
      loginContentRendered?: boolean
      privateContentRendered?: boolean
    }
    verificationWindow.loginContentRendered = false
    verificationWindow.privateContentRendered = false

    new MutationObserver(() => {
      const visibleText = document.body.textContent

      if (visibleText?.includes('Entre na sua conta.')) {
        verificationWindow.loginContentRendered = true
      }

      if (visibleText?.includes('Histórico mensal')) {
        verificationWindow.privateContentRendered = true
      }
    }).observe(document.documentElement, { childList: true, subtree: true })
  })

  await page.goto('/app')

  await expect(page).toHaveURL('/login?redirect=%2Fapp')
  await expect(
    page.getByRole('heading', { name: 'Entre na sua conta.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      Boolean(
        (window as Window & { privateContentRendered?: boolean })
          .privateContentRendered,
      ),
    ),
  ).toBe(false)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill('invalid-password')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toHaveText('Email ou senha inválidos')
  await expect(page.getByText(/Invalid login credentials/)).toHaveCount(0)

  await page.goto(
    '/login?redirect=https%3A%2F%2Fexample.com%2Foutside-this-application',
  )
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  const authenticatedAppUrl = page.url()

  await page.reload()

  await expect(page).toHaveURL(authenticatedAppUrl)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  expect(
    await page.evaluate(() =>
      Boolean(
        (window as Window & { loginContentRendered?: boolean })
          .loginContentRendered,
      ),
    ),
  ).toBe(false)

  await page.goto('/login')

  await expect(page).toHaveURL(authenticatedAppUrl)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()

  await expect(page).toHaveURL(
    `/login?redirect=${encodeURIComponent(new URL(authenticatedAppUrl).pathname + new URL(authenticatedAppUrl).search)}`,
  )
  await expect(
    page.getByRole('heading', { name: 'Entre na sua conta.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)

  await page.goBack()

  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toHaveCount(
    0,
  )
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:4173\//)
})
