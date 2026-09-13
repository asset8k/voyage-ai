import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { PlanTripPage } from './PlanTripPage'
import { ToastProvider } from '../components/ToastProvider'

describe('PlanTripPage', () => {
  it('lets a traveller count be cleared before a new valid value is entered', () => {
    render(<ToastProvider><MemoryRouter><PlanTripPage /></MemoryRouter></ToastProvider>)

    const travellers = screen.getByRole('spinbutton', { name: 'Travellers' })
    fireEvent.change(travellers, { target: { value: '' } })
    expect(travellers).toHaveValue(null)

    fireEvent.change(travellers, { target: { value: '2' } })
    expect(travellers).toHaveValue(2)
  })

  it('offers styled popular currencies while allowing another three-letter code', () => {
    render(<ToastProvider><MemoryRouter><PlanTripPage /></MemoryRouter></ToastProvider>)

    const currency = screen.getByRole('combobox', { name: 'Currency' })
    fireEvent.click(screen.getByRole('button', { name: 'Show currency options' }))
    expect(screen.getByRole('option', { name: /jpy japanese yen/i })).toBeInTheDocument()
    fireEvent.change(currency, { target: { value: 'brl' } })
    expect(currency).toHaveValue('BRL')
  })
})
