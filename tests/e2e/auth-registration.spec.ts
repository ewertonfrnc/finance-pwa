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

  await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  const finalUrl = new URL(page.url())
  expect(finalUrl.origin).toBe('http://127.0.0.1:4173')
  expect(finalUrl.hash).toBe('')
  expect(finalUrl.search).toMatch(/^\?month=\d{4}-\d{2}$/)
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
