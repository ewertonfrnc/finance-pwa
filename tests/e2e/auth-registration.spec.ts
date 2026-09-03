import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { deleteLocalAuthUserByEmail } from './support/auth-admin'
import {
  findMailpitMessageByRecipient,
  readMailpitMessageLink,
} from './support/mailpit'

const password = 'local-password-123'

let email: string

test.beforeEach(async ({ browserName }, testInfo) => {
  email = `auth-registration-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
})

test.afterEach(async () => {
  await deleteLocalAuthUserByEmail(email)
})

test('should create an account, confirm it from Mailpit, and open the app', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Criar minha conta' }).click()

  await expect(page).toHaveURL('/register')
  await expect(
    page.getByRole('heading', { name: 'Crie sua conta.' }),
  ).toBeVisible()

  await page.evaluate(() => navigator.serviceWorker.ready)
  const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
  await offlineReadyAction
    .waitFor({ state: 'visible', timeout: 2_000 })
    .catch(() => undefined)
  if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirme a senha').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(
    page.getByRole('heading', { name: 'Confira seu email.' }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toContainText(email)

  await page.goto('/app')
  await expect(page).toHaveURL('/login?redirect=%2Fapp')

  const message = await findMailpitMessageByRecipient(email)
  await page.goto(readMailpitMessageLink(message))

  await expect(page).toHaveURL('/onboarding')
  await expect(
    page.getByRole('heading', { name: 'Ponto de partida' }),
  ).toBeVisible()

  // Complete onboarding: 5000 cents available on today's date.
  await page.getByLabel('Saldo inicial').fill('5000')
  await expect(page.getByLabel('Saldo inicial')).toHaveValue('50,00')
  await page.getByRole('button', { name: 'Revisar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revise seu ponto de partida' }),
  ).toBeVisible()
  await expect(page.getByText('R$ 50,00')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar ponto de partida' }).click()

  await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  const finalUrl = new URL(page.url())
  expect(finalUrl.origin).toBe('http://127.0.0.1:4173')
  expect(finalUrl.hash).toBe('')
  expect(finalUrl.search).toMatch(/^\?month=\d{4}-\d{2}$/)

  // Reload should bypass onboarding for the returning user.
  await page.reload()
  await expect(page).toHaveURL(finalUrl.pathname + finalUrl.search)
  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Ponto de partida' }),
  ).toHaveCount(0)
})

test('should remove an expired callback error before showing a retry path', async ({
  page,
}) => {
  await page.goto(
    '/auth/confirm#error=access_denied&error_code=otp_expired&error_description=Provider%20secret',
  )

  await expect(page).toHaveURL('/auth/confirm')
  await expect(
    page.getByRole('heading', { name: 'Este link expirou.' }),
  ).toBeVisible()
  await expect(page.getByText(/Provider secret/)).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Voltar ao cadastro' }),
  ).toHaveAttribute('href', '/register')
})
