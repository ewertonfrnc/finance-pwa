import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MonthSelector } from './month-selector'

describe('MonthSelector', () => {
  it('should expose the selected month and navigate in both directions', () => {
    const onMonthChange = vi.fn<(month: string) => void>()
    render(<MonthSelector month="2026-08" onMonthChange={onMonthChange} />)

    expect(
      screen.getByRole('heading', { name: 'Agosto de 2026' }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))

    expect(onMonthChange.mock.calls).toEqual([['2026-07'], ['2026-09']])
  })

  it('should stop navigation at the supported calendar boundaries', () => {
    const onMonthChange = vi.fn<(month: string) => void>()
    const { rerender } = render(
      <MonthSelector month="0001-01" onMonthChange={onMonthChange} />,
    )

    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled()

    rerender(<MonthSelector month="9999-12" onMonthChange={onMonthChange} />)

    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
  })
})
