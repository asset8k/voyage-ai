import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TripProcessingScreen } from './TripProcessingScreen'

describe('TripProcessingScreen', () => {
  it('shows a focused wait state while a new itinerary is generated', () => {
    render(<TripProcessingScreen mode="generation" />)

    expect(screen.getByRole('heading', { name: 'Creating your itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Considering the details that matter most to you')
    expect(screen.getByText('This can take a moment.')).toBeInTheDocument()
  })

  it('uses refinement-specific copy for a saved trip update', () => {
    render(<TripProcessingScreen mode="refinement" />)

    expect(screen.getByRole('heading', { name: 'Refining your itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Considering how your instruction changes the plan')
  })
})
