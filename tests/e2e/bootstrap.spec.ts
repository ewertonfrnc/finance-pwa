import { expect, test } from '@playwright/test'

test('should render the home page without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Veja o mês inteiro antes de gastar.',
    }),
  ).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )

  expect(hasHorizontalOverflow).toBe(false)
})

test('should open a client route directly and return home', async ({
  page,
}) => {
  await page.goto('/offline')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Sem internet, sem dados desatualizados.',
    }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Voltar ao início' }).click()

  await expect(page).toHaveURL('/')
})

test('should expose an installable manifest and register its service worker', async ({
  page,
}) => {
  await page.goto('/')

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  expect(manifestHref).toBe('/manifest.webmanifest')

  const manifestResponse = await page.request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)

  const manifest = (await manifestResponse.json()) as {
    display: string
    icons: Array<{ sizes: string; src: string }>
    name: string
    short_name: string
  }

  expect(manifest).toMatchObject({
    display: 'standalone',
    name: 'Finance PWA',
    short_name: 'Finance',
  })
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual([
    '192x192',
    '512x512',
    '512x512',
  ])

  const iconDimensions = await page.evaluate(
    async (iconSources) => {
      return Promise.all(
        iconSources.map(
          (source) =>
            new Promise<{ height: number; width: number }>(
              (resolve, reject) => {
                const image = new Image()
                image.addEventListener('load', () => {
                  resolve({
                    height: image.naturalHeight,
                    width: image.naturalWidth,
                  })
                })
                image.addEventListener('error', reject)
                image.src = source
              },
            ),
        ),
      )
    },
    manifest.icons.map((icon) => icon.src),
  )

  expect(iconDimensions).toEqual([
    { height: 192, width: 192 },
    { height: 512, width: 512 },
    { height: 512, width: 512 },
  ])

  const serviceWorkerScope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.scope
  })

  expect(serviceWorkerScope).toBe('http://127.0.0.1:4173/')
})
