import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import {
  getDefaultTransactionDate,
  getLocalCurrentMonth,
} from '../../src/features/transactions/transaction-calendar'
import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import { readContrastRatio } from './support/contrast'

const password = 'local-password-123'

let email: string
let userId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  email = `transactions-create-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
  userId = ''

  const user = await createLocalAuthUser({ email, password })
  userId = user.id
})

test.afterEach(async () => {
  if (userId) await deleteLocalAuthUser(userId)
})

test('should create a transaction and keep it after reload', async ({
  page,
}) => {
  const month = getLocalCurrentMonth()
  const date = getDefaultTransactionDate(month)

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await page.getByRole('link', { name: 'Adicionar' }).click()

  await expect(page).toHaveURL(`/app/transactions/new?month=${month}`)
  await expect(
    page.getByRole('heading', { name: 'Novo lançamento' }),
  ).toBeVisible()
  await expect(page.getByLabel('Data')).toHaveValue(date)
  await expect(page.getByText(/^Hoje · /)).toBeVisible()

  const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
  await offlineReadyAction
    .waitFor({ state: 'visible', timeout: 2_000 })
    .catch(() => undefined)
  if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

  const viewport = page.viewportSize()
  const amount = await page.getByLabel('Valor').boundingBox()

  expect(viewport).not.toBeNull()
  expect(amount).not.toBeNull()
  expect(amount!.x).toBeGreaterThanOrEqual(32)
  expect(viewport!.width - amount!.x - amount!.width).toBeGreaterThanOrEqual(32)
  const amountFont = await page.evaluate(async () => {
    await document.fonts.ready
    const probe = document.querySelector<HTMLElement>('span.font-mono')
    const fontFace = [...document.fonts].find((face) =>
      face.family.includes('JetBrains Mono'),
    )

    return {
      family: probe ? getComputedStyle(probe).fontFamily : null,
      status: fontFace?.status ?? 'missing',
    }
  })
  expect(amountFont.family).toContain('JetBrains Mono')
  expect(amountFont.status).toBe('loaded')

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.getByLabel('Descrição (opcional)').fill('Rascunho para contraste')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  const discardDialog = page.getByRole('dialog')
  await expect(discardDialog).toBeVisible()
  expect(
    await readContrastRatio(
      discardDialog.getByRole('button', { name: 'Descartar' }),
    ),
  ).toBeGreaterThanOrEqual(4.5)
  await discardDialog
    .getByRole('button', { name: 'Continuar editando' })
    .click()

  const typePicker = page.getByRole('button', { name: 'Tipo: Saída' })
  await expect(typePicker).toHaveAttribute('aria-expanded', 'false')
  await typePicker.click()
  await expect(page.getByRole('radio', { name: 'Entrada' })).toBeVisible()
  await page
    .getByRole('group', { name: 'Escolha o tipo' })
    .getByText('Saída', { exact: true })
    .click()
  await expect(typePicker).toHaveAttribute('aria-expanded', 'false')

  await page.getByLabel('Valor').fill('5000')
  await expect(page.getByLabel('Valor')).toHaveValue('50,00')
  await page.getByLabel('Descrição (opcional)').fill('Mercado do E2E')
  await page.getByRole('button', { name: 'Lançar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado do E2E')).toBeVisible()
  await expect(page.getByText('R$ 50,00')).toBeVisible()

  await page.reload()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText('Mercado do E2E')).toBeVisible()
  await expect(page.getByText('R$ 50,00')).toBeVisible()

  const layout = await page.evaluate(() => ({
    hasHorizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }))
  expect(layout.hasHorizontalOverflow).toBe(false)
})
