import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { assertLoopbackUrl } from '../../scripts/loopback-url'
import {
  getDefaultTransactionDate,
  getLocalCurrentMonth,
} from '../../src/features/transactions/transaction-calendar'
import { TRANSACTION_KIND_META } from '../../src/features/transactions/transaction-kind'
import type { TransactionKind } from '../../src/features/transactions/transaction-types'
import {
  createLocalAuthAdminClient,
  createLocalAuthUser,
  deleteLocalAuthUser,
} from './support/auth-admin'
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

// One entry per generated kind. The first entry keeps the form's `expense`
// default so its creation reuses the flow already exercising unrelated
// layout, font, and draft-discard assertions; the other three go through the
// kind picker.
const kindTransactions: Array<{
  amountDigits: string
  amountLabel: string
  description: string
  kind: TransactionKind
}> = [
  {
    amountDigits: '5000',
    amountLabel: 'R$ 50,00',
    description: 'Mercado do E2E',
    kind: 'expense',
  },
  {
    amountDigits: '150000',
    amountLabel: 'R$ 1.500,00',
    description: 'Salário via E2E',
    kind: 'income',
  },
  {
    amountDigits: '850',
    amountLabel: 'R$ 8,50',
    description: 'Padaria via E2E',
    kind: 'daily',
  },
  {
    amountDigits: '30000',
    amountLabel: 'R$ 300,00',
    description: 'Reserva via E2E',
    kind: 'savings',
  },
]

test('should create a transaction of each kind and keep every row after reload', async ({
  page,
}) => {
  const month = getLocalCurrentMonth()
  const date = getDefaultTransactionDate(month)
  const [firstTransaction, ...remainingTransactions] = kindTransactions

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

  // The four generated kinds render an expanded picker at 390 by 844 CSS
  // pixels, the width playwright.config.ts's mobile-chromium project does not
  // cover, without horizontal overflow or an undersized interactive target.
  await page.setViewportSize({ width: 390, height: 844 })
  const pickerLayout = await page.evaluate(() => ({
    hasHorizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    undersizedTargets: Array.from(
      document.querySelectorAll<HTMLElement>('form button, form label'),
    )
      .filter((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.width > 0 && bounds.height > 0
      })
      .filter((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.width < 44 || bounds.height < 44
      })
      .map(
        (element) =>
          element.getAttribute('aria-label') ??
          element.textContent?.trim() ??
          element.tagName,
      ),
  }))
  expect(pickerLayout.hasHorizontalOverflow).toBe(false)
  expect(pickerLayout.undersizedTargets).toEqual([])
  if (viewport) await page.setViewportSize(viewport)

  await page
    .getByRole('group', { name: 'Escolha o tipo' })
    .getByText(TRANSACTION_KIND_META[firstTransaction.kind].label, {
      exact: true,
    })
    .click()
  await expect(typePicker).toHaveAttribute('aria-expanded', 'false')

  await page.getByLabel('Valor').fill(firstTransaction.amountDigits)
  await expect(page.getByLabel('Valor')).toHaveValue('50,00')
  await page
    .getByLabel('Descrição (opcional)')
    .fill(firstTransaction.description)
  await page.getByRole('button', { name: 'Lançar' }).click()

  await expect(page).toHaveURL(`/app?month=${month}`)
  await expect(page.getByText(firstTransaction.description)).toBeVisible()
  await expect(page.getByText(firstTransaction.amountLabel)).toBeVisible()

  for (const transaction of remainingTransactions) {
    await page.getByRole('link', { name: 'Adicionar' }).click()
    await expect(page).toHaveURL(`/app/transactions/new?month=${month}`)

    await page.getByRole('button', { name: 'Tipo: Saída' }).click()
    await page
      .getByRole('group', { name: 'Escolha o tipo' })
      .getByText(TRANSACTION_KIND_META[transaction.kind].label, {
        exact: true,
      })
      .click()

    await page.getByLabel('Valor').fill(transaction.amountDigits)
    await page.getByLabel('Descrição (opcional)').fill(transaction.description)
    await page.getByRole('button', { name: 'Lançar' }).click()

    await expect(page).toHaveURL(`/app?month=${month}`)
    await expect(page.getByText(transaction.description)).toBeVisible()
  }

  await page.reload()

  await expect(page).toHaveURL(`/app?month=${month}`)
  for (const transaction of kindTransactions) {
    const meta = TRANSACTION_KIND_META[transaction.kind]

    await expect(page.getByText(transaction.description)).toBeVisible()
    await expect(page.getByText(meta.label, { exact: true })).toBeVisible()
    await expect(
      page.getByText(`${meta.sign} ${transaction.amountLabel}`),
    ).toBeVisible()
  }

  // A computed-color difference between the four category marks is an
  // objective proxy for "visually distinct"; it does not replace looking at
  // the rendered marks and their contrast, which this suite cannot do.
  const readBadgeColors = () =>
    Promise.all(
      kindTransactions.map((transaction) =>
        page
          .getByRole('link', { name: new RegExp(transaction.description) })
          .evaluate((element) => {
            const badge = element.querySelector('span[aria-hidden="true"]')
            return badge ? getComputedStyle(badge).backgroundColor : null
          }),
      ),
    )

  expect(new Set(await readBadgeColors()).size).toBe(4)

  await page.emulateMedia({ colorScheme: 'light' })
  expect(new Set(await readBadgeColors()).size).toBe(4)

  const layout = await page.evaluate(() => ({
    hasHorizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }))
  expect(layout.hasHorizontalOverflow).toBe(false)
})

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]

  if (!value)
    throw new Error(`Missing local test environment variable: ${name}`)

  return value
}

test('should reject an authenticated transfer RPC and insert no row', async () => {
  const apiUrl = assertLoopbackUrl(
    requireEnvironmentVariable('LOCAL_SUPABASE_URL'),
    'Local Supabase API URL',
  )
  const publishableKey = requireEnvironmentVariable(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  )

  // Untyped on purpose: `p_kind: 'transfer'` is a typed-boundary bypass the
  // generated `TransactionKind` union would otherwise reject at compile time.
  const anonClient = createClient(apiUrl.origin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })
  expect(signInError).toBeNull()

  const attemptedId = randomUUID()
  const { data, error } = await anonClient.rpc('create_transaction', {
    p_amount_cents: 1000,
    p_description: '',
    p_id: attemptedId,
    p_kind: 'transfer',
    p_transaction_date: '2026-08-25',
  })

  expect(data).toBeNull()
  expect(error?.code).toBe('22P02')

  const adminClient = createLocalAuthAdminClient()
  const { data: insertedRow, error: readError } = await adminClient
    .from('transactions')
    .select()
    .eq('id', attemptedId)
    .maybeSingle()

  expect(readError).toBeNull()
  expect(insertedRow).toBeNull()
})
