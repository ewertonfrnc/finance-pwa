import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'

import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import {
  createLocalTransactionFixtures,
  updateLocalTransactionFixture,
} from './support/finance-admin'
import { readContrastRatio } from './support/contrast'

const password = 'local-password-123'
const month = '2026-08'

let email: string
let userId: string
let transactionId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  email = `transactions-delete-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
  userId = ''
  transactionId = randomUUID()

  const user = await createLocalAuthUser({ email, password })
  userId = user.id

  await createLocalTransactionFixtures([
    {
      amount_cents: 5000,
      created_at: '2026-08-25T12:00:00Z',
      description: 'Mercado para excluir',
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

  const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
  await offlineReadyAction
    .waitFor({ state: 'visible', timeout: 2_000 })
    .catch(() => undefined)
  if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

  await page.getByRole('link', { name: /Mercado para excluir/ }).click()

  await expect(page).toHaveURL(
    `/app/transactions/${transactionId}/edit?month=${month}`,
  )
  await expect(
    page.getByRole('heading', { name: 'Editar lançamento' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Excluir lançamento' }),
  ).toBeVisible()
}

test('should delete the transaction and keep it deleted after reload', async ({
  page,
}) => {
  await openTheTransaction(page)

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.getByRole('button', { name: 'Excluir lançamento' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('heading', { name: 'Excluir lançamento?' }),
  ).toBeVisible()
  await expect(dialog.getByText(/Mercado para excluir ·/)).toBeVisible()
  const displayedAmount = dialog.getByText('R$ 50,00')
  await expect(displayedAmount).toBeVisible()
  const amountFont = await displayedAmount.evaluate(async (element) => {
    await document.fonts.ready
    const fontFace = [...document.fonts].find((face) =>
      face.family.includes('JetBrains Mono'),
    )

    return {
      family: getComputedStyle(element).fontFamily,
      status: fontFace?.status ?? 'missing',
    }
  })
  expect(amountFont.family).toContain('JetBrains Mono')
  expect(amountFont.status).toBe('loaded')
  const confirmDelete = dialog.getByRole('button', { name: 'Excluir' })
  await expect(confirmDelete).toBeEnabled()
  expect(await readContrastRatio(confirmDelete)).toBeGreaterThanOrEqual(4.5)
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeEnabled()

  await confirmDelete.click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado para excluir')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()

  await page.reload()

  await expect(page.getByText('Mercado para excluir')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()
})

test('should keep the dialog recoverable when the delete fails', async ({
  page,
}) => {
  await openTheTransaction(page)

  await page.getByRole('button', { name: 'Excluir lançamento' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Simulate a concurrent change so the next delete hits transaction_conflict.
  await updateLocalTransactionFixture(transactionId, {
    amount_cents: 9900,
    description: 'Mercado do outro aparelho',
    updated_at: '2026-08-26T08:00:00Z',
  })

  await dialog.getByRole('button', { name: 'Excluir' }).click()

  await expect(dialog.getByRole('alert')).toContainText(
    'foi alterado em outro lugar',
  )
  await expect(page).toHaveURL(
    `/app/transactions/${transactionId}/edit?month=${month}`,
  )

  await dialog.getByRole('button', { name: 'Recarregar lançamento' }).click()

  await expect(page.getByLabel('Valor')).toHaveValue('99,00')
  await expect(page.getByLabel('Descrição (opcional)')).toHaveValue(
    'Mercado do outro aparelho',
  )
  // The dialog stays open after the reload, so retry the same confirmation.
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Excluir' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado do outro aparelho')).toBeHidden()
})

test('should cancel the delete without mutating the row', async ({ page }) => {
  await openTheTransaction(page)

  await page.getByRole('button', { name: 'Excluir lançamento' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(
    `/app/transactions/${transactionId}/edit?month=${month}`,
  )
  await expect(page.getByLabel('Valor')).toHaveValue('50,00')

  await page.goto(`/app?month=${month}`)
  await expect(page.getByText('Mercado para excluir')).toBeVisible()
})
