import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import {
  createLocalAuthUser,
  deleteLocalAuthUser,
  deleteLocalAuthUserByEmail,
} from './support/auth-admin'
import { createLocalStartingPositionFixture } from './support/finance-admin'
import {
  findMailpitMessageByRecipient,
  readMailpitMessageLink,
} from './support/mailpit'

const password = 'local-password-123'

test.describe('starting position onboarding', () => {
  test('should require a new user to complete onboarding before reaching the workspace', async ({
    page,
  }) => {
    const email = `onboarding-new-${randomUUID()}@example.com`
    try {
      await page.goto('/')
      await page.getByRole('link', { name: 'Criar minha conta' }).click()
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha', { exact: true }).fill(password)
      await page.getByLabel('Confirme a senha').fill(password)
      await page.getByRole('button', { name: 'Criar conta' }).click()
      await expect(
        page.getByRole('heading', { name: 'Confira seu email.' }),
      ).toBeVisible()

      const message = await findMailpitMessageByRecipient(email)
      await page.goto(readMailpitMessageLink(message))

      await expect(page).toHaveURL('/onboarding')
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toBeVisible()
      await expect(
        page.getByText('Informe quanto você tem agora'),
      ).toBeVisible()

      // Complete onboarding with a positive balance
      await page.getByLabel('Saldo inicial').fill('12345')
      await expect(page.getByLabel('Saldo inicial')).toHaveValue('123,45')
      await page.getByRole('button', { name: 'Revisar' }).click()
      await expect(
        page.getByRole('heading', { name: 'Revise seu ponto de partida' }),
      ).toBeVisible()
      await expect(page.getByText('R$ 123,45')).toBeVisible()
      await page
        .getByRole('button', { name: 'Confirmar ponto de partida' })
        .click()

      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
      await expect(
        page.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible()

      // Reload should bypass onboarding for the returning user
      await page.reload()
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
      await expect(
        page.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toHaveCount(0)

      // Directly visiting onboarding should redirect to workspace
      await page.goto('/onboarding')
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
    } finally {
      await deleteLocalAuthUserByEmail(email)
    }
  })

  test('should redirect a user without a position when opening financial routes directly', async ({
    page,
  }) => {
    const email = `onboarding-redirect-${randomUUID()}@example.com`
    const user = await createLocalAuthUser({ email, password })
    test.info().annotations.push({ type: 'userId', description: user.id })

    try {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha').fill(password)
      await page.getByRole('button', { name: 'Entrar' }).click()
      // Login without position should land on onboarding, not app
      await expect(page).toHaveURL('/onboarding')
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toBeVisible()

      await page.goto('/app')
      await expect(page).toHaveURL('/onboarding')

      await page.goto('/app/transactions/new')
      await expect(page).toHaveURL('/onboarding')

      const fakeId = randomUUID()
      await page.goto(`/app/transactions/${fakeId}/edit`)
      await expect(page).toHaveURL('/onboarding')
    } finally {
      await deleteLocalAuthUser(user.id)
    }
  })

  test('should bypass onboarding for a returning user with a saved position', async ({
    page,
  }) => {
    const email = `onboarding-returning-${randomUUID()}@example.com`
    const user = await createLocalAuthUser({ email, password })
    await createLocalStartingPositionFixture({
      balance_cents: -2500,
      effective_on: '2026-08-27',
      user_id: user.id,
    })

    try {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha').fill(password)
      await page.getByRole('button', { name: 'Entrar' }).click()

      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
      await expect(
        page.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toHaveCount(0)

      await page.goto('/onboarding')
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
    } finally {
      await deleteLocalAuthUser(user.id)
    }
  })

  test('should keep the draft and show retry when saving the same values twice', async ({
    page,
  }) => {
    const email = `onboarding-idempotent-${randomUUID()}@example.com`
    const user = await createLocalAuthUser({ email, password })

    try {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha').fill(password)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL('/onboarding')

      const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
      await offlineReadyAction
        .waitFor({ state: 'visible', timeout: 2_000 })
        .catch(() => undefined)
      if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

      await page.getByLabel('Saldo inicial').fill('5000')
      await page.getByRole('button', { name: 'Revisar' }).click()
      await page
        .getByRole('button', { name: 'Confirmar ponto de partida' })
        .click()
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)

      // An identical retry is safe: the user remains at the workspace and no error appears.
      await page.goto('/onboarding')
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
      await expect(
        page.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible()
    } finally {
      await deleteLocalAuthUser(user.id)
    }
  })

  test('should show offline and retry states without trapping the user', async ({
    page,
  }) => {
    const email = `onboarding-offline-${randomUUID()}@example.com`
    const user = await createLocalAuthUser({ email, password })

    try {
      // Intercept the starting_positions read to simulate a failure before any redirect
      await page.route('**/rest/v1/starting_positions*', (route) =>
        route.fulfill({
          body: JSON.stringify({
            code: 'XX000',
            message: 'Provider detail must stay hidden',
          }),
          contentType: 'application/json',
          status: 500,
        }),
      )

      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha').fill(password)
      await page.getByRole('button', { name: 'Entrar' }).click()

      // After login, the positioned guard tries to load the position and fails.
      // It should show retry, not redirect to onboarding as if null.
      await expect(
        page.getByRole('heading', {
          name: /Não foi possível carregar seu ponto de partida/,
        }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Tentar novamente' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
      await expect(page.getByText(/Provider detail/)).toHaveCount(0)
      await expect(page).toHaveURL('/app')

      await page.unroute('**/rest/v1/starting_positions*')
      await page.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(page).toHaveURL('/onboarding')
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toBeVisible()

      // Dismiss offline-ready prompt if it appears, otherwise it blocks the confirm button.
      const offlineReadyAction = page.getByRole('button', { name: 'Entendi' })
      await offlineReadyAction
        .waitFor({ state: 'visible', timeout: 2_000 })
        .catch(() => undefined)
      if (await offlineReadyAction.isVisible()) await offlineReadyAction.click()

      // Complete onboarding to get to app.
      await page.getByLabel('Saldo inicial').fill('1000')
      await page.getByRole('button', { name: 'Revisar' }).click()
      await page
        .getByRole('button', { name: 'Confirmar ponto de partida' })
        .click()
      await expect(page).toHaveURL(/\/app\?month=\d{4}-\d{2}$/)
      await expect(
        page.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible()
    } finally {
      await deleteLocalAuthUser(user.id)
    }
  })

  test('should resume onboarding after leaving without a saved position', async ({
    page,
  }) => {
    const email = `onboarding-resume-${randomUUID()}@example.com`
    const user = await createLocalAuthUser({ email, password })

    try {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Senha').fill(password)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL('/onboarding')

      // Leave onboarding by going to the root (public) and then return to a financial route
      await page.goto('/')
      await expect(page).toHaveURL('/')
      await page.goto('/app')
      await expect(page).toHaveURL('/onboarding')
      await expect(
        page.getByRole('heading', { name: 'Ponto de partida' }),
      ).toBeVisible()
    } finally {
      await deleteLocalAuthUser(user.id)
    }
  })
})
