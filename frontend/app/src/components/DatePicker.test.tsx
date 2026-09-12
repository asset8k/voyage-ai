import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DatePicker } from './DatePicker'

describe('DatePicker', () => {
  it('opens a Monday-first calendar', () => {
    render(<DatePicker label="Arrival" value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Arrival' }))

    const weekdays = Array.from(document.querySelectorAll('.rdp-weekday')).map((header) => header.textContent)
    expect(weekdays).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
  })
})
