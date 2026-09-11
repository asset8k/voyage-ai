import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('offers a clear route back to trip planning', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'We could not find that page.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /plan a trip/i })).toHaveAttribute('href', '/')
  })
})
