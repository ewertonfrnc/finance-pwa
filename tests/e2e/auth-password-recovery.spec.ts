import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import { createLocalStartingPositionFixture } from './support/finance-admin'
import {
  findMailpitMessageByRecipient,
  readMailpitMessageLink,
} from './support/mailpit'

const oldPassword = 'old-password-123'
const newPassword = 'new-password-456'

let email: string
let unknownEmail: string
let userId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  userId = ''
  const uniqueId = `${browserName}-${testInfo.project.name}-${randomUUID()}`
  email = `auth-recovery-${uniqueId}@example.com`
  unknownEmail = `auth-recovery-unknown-${uniqueId}@example.com`
  const user = await createLocalAuthUser({ email, password: oldPassword })
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

async function requestRecovery(
  page: import('@playwright/test').Page,
  value: string,
) {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()

  await expect(page).toHaveURL('/forgot-password')
  await page.getByLabel('Email').fill(value)
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()

  await expect(
    page.getByRole('heading', { name: 'Confira seu email.' }),
  ).toBeVisible()

  return page.getByRole('status').textContent()
}

test('should replace the password through Mailpit and require the new credential', async ({
  page,
}) => {
  const unknownCompletion = await requestRecovery(page, unknownEmail)
  const existingCompletion = await requestRecovery(page, email)

  expect(existingCompletion).toBe(unknownCompletion)
  expect(existingCompletion).toContain(
    'Se houver uma conta com esse email, você receberá um link para criar uma nova senha.',
  )

  const message = await findMailpitMessageByRecipient(email)
  await page.goto(readMailpitMessageLink(message))

  await expect(page).toHaveURL('/auth/update-password')
  await expect(
    page.getByRole('heading', { name: 'Crie uma nova senha.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Seu espaço financeiro começa aqui.',
    }),
  ).toHaveCount(0)

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Crie uma nova senha.' }),
  ).toBeVisible()

  await page.goto('/app')
  await expect(page).toHaveURL('/auth/update-password')
  await expect(
    page.getByRole('heading', { name: 'Crie uma nova senha.' }),
  ).toBeVisible()

  await page.getByLabel('Nova senha', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirme a nova senha').fill(newPassword)
  await page.getByRole('button', { name: 'Alterar senha' }).click()

  await expect(page).toHaveURL('/login?notice=password-updated')
  await expect(page.getByRole('status')).toHaveText(
    'Senha alterada. Entre com sua nova senha.',
  )

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(oldPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toHaveText('Email ou senha inválidos')
  await expect(page).toHaveURL('/login?notice=password-updated')

  await page.getByLabel('Senha').fill(newPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
  await expect(page.getByRole('heading', { name: 'Lançamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  const finalUrl = new URL(page.url())
  expect(finalUrl.hash).toBe('')
  expect(finalUrl.search).toMatch(/^\?month=\d{4}-\d{2}$/)
})

test('should remove an expired recovery callback before showing a retry path', async ({
  page,
}) => {
  await page.goto(
    '/auth/update-password#error=access_denied&error_code=otp_expired&error_description=Provider%20secret',
  )

  await expect(page).toHaveURL('/auth/update-password')
  await expect(
    page.getByRole('heading', { name: 'Este link expirou.' }),
  ).toBeVisible()
  await expect(page.getByText(/Provider secret/)).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Solicitar outro link' }),
  ).toHaveAttribute('href', '/forgot-password')
})
