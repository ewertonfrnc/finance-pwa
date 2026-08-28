import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { TRANSACTION_KIND_META } from '../../src/features/transactions/transaction-kind'
import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import {
  createLocalStartingPositionFixture,
  createLocalTransactionFixtures,
  updateLocalTransactionFixture,
} from './support/finance-admin'

const password = 'local-password-123'
const month = '2026-08'

let email: string
let userId: string
let transactionId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  email = `transactions-edit-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
  userId = ''
  transactionId = randomUUID()

  const user = await createLocalAuthUser({ email, password })
  userId = user.id
  await createLocalStartingPositionFixture({
    balance_cents: 5000,
    effective_on: '2026-08-27',
    user_id: userId,
  })

  await createLocalTransactionFixtures([
    {
      amount_cents: 5000,
      created_at: '2026-08-25T12:00:00Z',
      description: 'Mercado da semana',
      id: transactionId,
      kind: 'expense',
      transaction_date: '2026-08-25',
      updated_at: '2026-08-25T12:00:00Z',
      user_id: userId,
    },
  ])
})

test.afterEach(async () => {
  if (userId) await deleteLocalAuthUser(userId)
})

async function openTheTransaction(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/app\?month=/)
  await page.goto(`/app?month=${month}`)

  // The offline-ready toast can cover the list on a cold service worker.
  const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
  await offlineReadyAction
    .waitFor({ state: 'visible', timeout: 2_000 })
    .catch(() => undefined)
  if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

  await page.getByRole('link', { name: /Mercado da semana/ }).click()

  await expect(page).toHaveURL(
    `/app/transactions/${transactionId}/edit?month=${month}`,
  )
  await expect(
    page.getByRole('heading', { name: 'Editar lançamento' }),
  ).toBeVisible()
  await expect(page.getByLabel('Valor')).toHaveValue('50,00')
}

test('should persist an edited amount and description', async ({ page }) => {
  await openTheTransaction(page)

  await page.getByLabel('Valor').fill('7500')
  await page.getByLabel('Descrição (opcional)').fill('Mercado corrigido')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado corrigido')).toBeVisible()
  await expect(page.getByText('R$ 75,00')).toBeVisible()

  await page.reload()

  await expect(page.getByText('Mercado corrigido')).toBeVisible()
  await expect(page.getByText('R$ 75,00')).toBeVisible()
  await expect(page.getByText('Mercado da semana')).toBeHidden()
})

test('should change the transaction kind and keep it after reload', async ({
  page,
}) => {
  await openTheTransaction(page)

  const savingsLabel = TRANSACTION_KIND_META.savings.label
  // The button's accessible name carries the selected label, so it changes
  // from "Tipo: Saída" to "Tipo: Economia" once the new kind is picked.
  const typePicker = page.getByRole('button', { name: /^Tipo: / })
  await typePicker.click()
  await page
    .getByRole('group', { name: 'Escolha o tipo' })
    .getByText(savingsLabel, { exact: true })
    .click()
  await expect(typePicker).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado da semana')).toBeVisible()
  await expect(page.getByText(savingsLabel, { exact: true })).toBeVisible()

  await page.reload()

  await expect(page.getByText('Mercado da semana')).toBeVisible()
  await expect(page.getByText(savingsLabel, { exact: true })).toBeVisible()
})

test('should move the transaction to the month of its new date', async ({
  page,
}) => {
  await openTheTransaction(page)

  await page.getByLabel('Data').fill('2026-09-02')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page).toHaveURL('/app?month=2026-09')
  await expect(page.getByText('Mercado da semana')).toBeVisible()

  await page.goto(`/app?month=${month}`)

  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()
})

test('should refuse to overwrite a change made somewhere else', async ({
  page,
}) => {
  await openTheTransaction(page)

  await updateLocalTransactionFixture(transactionId, {
    amount_cents: 9900,
    description: 'Mercado do outro aparelho',
    updated_at: '2026-08-26T08:00:00Z',
  })

  await page.getByLabel('Valor').fill('7500')
  await page.getByRole('button', { name: 'Salvar' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('foi alterado em outro lugar')
  await expect(page).toHaveURL(
    `/app/transactions/${transactionId}/edit?month=${month}`,
  )
  await expect(page.getByLabel('Valor')).toHaveValue('75,00')

  await page.getByRole('button', { name: 'Recarregar lançamento' }).click()

  await expect(page.getByLabel('Valor')).toHaveValue('99,00')
  await expect(page.getByLabel('Descrição (opcional)')).toHaveValue(
    'Mercado do outro aparelho',
  )

  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('R$ 99,00')).toBeVisible()

  await page.reload()

  await expect(page.getByText('Mercado do outro aparelho')).toBeVisible()
  await expect(page.getByText('R$ 99,00')).toBeVisible()
})
