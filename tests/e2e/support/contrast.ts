import type { Locator } from '@playwright/test'

export function readContrastRatio(locator: Locator) {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element)

    // Playwright serializes this callback, so the helper must stay in browser scope.
    // oxlint-disable-next-line unicorn/consistent-function-scoping
    function luminance(color: string) {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map((channel) => Number(channel) / 255)
        .map((channel) =>
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4,
        )

      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }

    const foreground = luminance(styles.color)
    const background = luminance(styles.backgroundColor)

    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    )
  })
}
