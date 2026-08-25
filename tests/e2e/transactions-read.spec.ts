import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { createLocalAuthUser, deleteLocalAuthUser } from './support/auth-admin'
import { createLocalTransactionFixtures } from './support/finance-admin'

const password = 'local-password-123'

let email: string
let ownerId: string
let otherUserId: string

test.beforeEach(async ({ browserName }, testInfo) => {
  email = `transactions-read-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`
  ownerId = ''
  otherUserId = ''

  const [owner, otherUser] = await Promise.all([
    createLocalAuthUser({ email, password }),
    createLocalAuthUser({
      email: `transactions-other-${browserName}-${testInfo.project.name}-${randomUUID()}@example.com`,
      password,
    }),
  ])
  ownerId = owner.id
  otherUserId = otherUser.id

  await createLocalTransactionFixtures([
    {
      amount_cents: 500000,
      created_at: '2026-08-25T12:00:00Z',
      description: 'Salário de agosto',
      id: randomUUID(),
      kind: 'income',
      transaction_date: '2026-08-25',
      updated_at: '2026-08-25T12:00:00Z',
      user_id: ownerId,
    },
    {
      amount_cents: 12550,
      created_at: '2026-08-24T18:00:00Z',
      description: 'Mercado da semana',
      id: randomUUID(),
      kind: 'expense',
      transaction_date: '2026-08-24',
      updated_at: '2026-08-24T18:00:00Z',
      user_id: ownerId,
    },
    {
      amount_cents: 8990,
      created_at: '2026-07-31T10:00:00Z',
      description: 'Internet de julho',
      id: randomUUID(),
      kind: 'expense',
      transaction_date: '2026-07-31',
      updated_at: '2026-07-31T10:00:00Z',
      user_id: ownerId,
    },
    {
      amount_cents: 999999,
      created_at: '2026-08-26T10:00:00Z',
      description: 'Lançamento de outra pessoa',
      id: randomUUID(),
      kind: 'income',
      transaction_date: '2026-08-26',
      updated_at: '2026-08-26T10:00:00Z',
      user_id: otherUserId,
    },
  ])
})

test.afterEach(async () => {
  await Promise.all([
    ownerId ? deleteLocalAuthUser(ownerId) : Promise.resolve(),
    otherUserId ? deleteLocalAuthUser(otherUserId) : Promise.resolve(),
  ])
})

test('should read only the signed-in user monthly history across states', async ({
  context,
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)

  await page.goto('/app?month=2026-08')

  await expect(
    page.getByRole('heading', { name: 'Agosto de 2026' }),
  ).toBeVisible()
  await expect(page.getByText('Salário de agosto')).toBeVisible()
  await expect(page.getByText('Mercado da semana')).toBeVisible()
  await expect(page.getByText('R$ 5.000,00')).toBeVisible()
  await expect(page.getByText('R$ 125,50')).toBeVisible()
  await expect(page.getByText('Entrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Saída', { exact: true })).toBeVisible()
  await expect(page.getByText('Internet de julho')).toHaveCount(0)
  await expect(page.getByText('Lançamento de outra pessoa')).toHaveCount(0)

  const historyText = await page
    .getByRole('list', { name: 'Lançamentos do mês' })
    .innerText()
  expect(historyText.indexOf('Salário de agosto')).toBeLessThan(
    historyText.indexOf('Mercado da semana'),
  )

  const layoutEvidence = await page.evaluate(() => {
    const interactiveElements = Array.from(
      document.querySelectorAll<HTMLElement>('main a, main button'),
    ).filter((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.width > 0 && bounds.height > 0
    })

    return {
      hasHorizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      undersizedTargets: interactiveElements
        .filter((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.width < 44 || bounds.height < 44
        })
        .map(
          (element) => element.getAttribute('aria-label') ?? element.innerText,
        ),
    }
  })

  expect(layoutEvidence).toEqual({
    hasHorizontalOverflow: false,
    undersizedTargets: [],
  })

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByText('Entrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Saída', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(page).toHaveURL('/app?month=2026-07')
  await expect(page.getByText('Internet de julho')).toBeVisible()
  await expect(page.getByText('Salário de agosto')).toHaveCount(0)

  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(page).toHaveURL('/app?month=2026-09')
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()

  await page.route('**/rest/v1/transactions*', (route) =>
    route.fulfill({
      body: JSON.stringify({
        code: 'XX000',
        message: 'Provider detail must stay hidden',
      }),
      contentType: 'application/json',
      status: 500,
    }),
  )
  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(page).toHaveURL('/app?month=2026-10')
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar o mês.' }),
  ).toBeVisible()
  await expect(page.getByText(/Failed to fetch|Provider/)).toHaveCount(0)

  await page.unroute('**/rest/v1/transactions*')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()

  await context.setOffline(true)
  await expect(
    page.getByRole('heading', {
      name: 'Conecte-se para ver seus lançamentos.',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toHaveCount(0)

  await context.setOffline(false)
  await expect(
    page.getByRole('heading', { name: 'Nenhum lançamento neste mês.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
})
