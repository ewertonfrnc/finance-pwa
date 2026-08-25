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
  expect(manifest.icons).toEqual([
    expect.objectContaining({
      sizes: '192x192',
      src: '/pwa-192x192-v3.png',
    }),
    expect.objectContaining({
      sizes: '512x512',
      src: '/pwa-512x512-v3.png',
    }),
    expect.objectContaining({
      sizes: '512x512',
      src: '/pwa-maskable-512x512-v3.png',
    }),
  ])

  const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]')
  await expect(appleTouchIcon).toHaveAttribute(
    'href',
    '/apple-touch-icon-v3.png',
  )
  await expect(appleTouchIcon).toHaveAttribute('sizes', '180x180')

  const iconEvidence = await page.evaluate(
    async (iconSources) => {
      return Promise.all(
        iconSources.map(
          (source) =>
            new Promise<{
              accentRatio: number
              canvasRatio: number
              height: number
              inkRatio: number
              opaqueRatio: number
              width: number
            }>((resolve, reject) => {
              const image = new Image()
              image.addEventListener('load', () => {
                const canvas = document.createElement('canvas')
                canvas.height = image.naturalHeight
                canvas.width = image.naturalWidth

                const context = canvas.getContext('2d')
                if (!context) {
                  reject(new Error('Canvas context is unavailable'))
                  return
                }

                context.drawImage(image, 0, 0)
                const pixels = context.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                ).data
                const colors = {
                  accent: [201, 242, 119],
                  canvas: [243, 238, 228],
                  ink: [18, 60, 53],
                }
                const matches = { accent: 0, canvas: 0, ink: 0, opaque: 0 }

                for (let index = 0; index < pixels.length; index += 4) {
                  const [red, green, blue, alpha] = pixels.slice(
                    index,
                    index + 4,
                  )

                  if (alpha === 255) matches.opaque += 1

                  for (const [name, color] of Object.entries(colors)) {
                    if (
                      red === color[0] &&
                      green === color[1] &&
                      blue === color[2]
                    ) {
                      matches[name as keyof typeof colors] += 1
                    }
                  }
                }

                const pixelCount = canvas.width * canvas.height
                resolve({
                  accentRatio: matches.accent / pixelCount,
                  canvasRatio: matches.canvas / pixelCount,
                  height: image.naturalHeight,
                  inkRatio: matches.ink / pixelCount,
                  opaqueRatio: matches.opaque / pixelCount,
                  width: image.naturalWidth,
                })
              })
              image.addEventListener('error', reject)
              image.src = source
            }),
        ),
      )
    },
    ['/apple-touch-icon-v3.png', ...manifest.icons.map((icon) => icon.src)],
  )

  expect(iconEvidence.map(({ height, width }) => ({ height, width }))).toEqual([
    { height: 180, width: 180 },
    { height: 192, width: 192 },
    { height: 512, width: 512 },
    { height: 512, width: 512 },
  ])

  for (const evidence of iconEvidence) {
    expect(evidence.opaqueRatio).toBe(1)
    expect(evidence.canvasRatio).toBeLessThan(0.01)
    expect(evidence.inkRatio).toBeGreaterThan(0.8)
    expect(evidence.accentRatio).toBeGreaterThan(0.01)
  }

  const serviceWorkerScope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.scope
  })

  expect(serviceWorkerScope).toBe('http://127.0.0.1:4173/')
})
