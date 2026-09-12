import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { generatedTripFixture } from '../test/fixtures'
import { InteractiveMap } from './InteractiveMap'

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: ReactNode }) => <div data-testid="maps-provider">{children}</div>,
  Map: ({ children, className }: { children: ReactNode; className?: string }) => <div data-testid="google-map" className={className}>{children}</div>,
  Marker: ({ label, onClick }: { label: { text: string }; onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label={`Map marker ${label.text}`}>{label.text}</button>
  ),
  InfoWindow: ({ children }: { children: ReactNode }) => <div data-testid="map-info-window">{children}</div>,
  useMap: () => null,
}))

const resolvedDay = {
  ...generatedTripFixture.tripPlan.days[0],
  activities: [{
    ...generatedTripFixture.tripPlan.days[0].activities[0],
    resolved_places: [{
      provider: 'google_places' as const,
      place_id: 'place-tokyo',
      name: 'Tokyo Station',
      formatted_address: 'Marunouchi, Tokyo',
      latitude: 35.6812,
      longitude: 139.7671,
      photo_reference: null,
    }],
  }],
}

describe('InteractiveMap', () => {
  it('explains when a day has no resolved places', () => {
    render(<InteractiveMap day={generatedTripFixture.tripPlan.days[0]} apiKey="browser-key" />)

    expect(screen.getByText('No map-ready stops for this day yet.')).toBeInTheDocument()
  })

  it('renders clean numbered map markers and a place popup', () => {
    render(<InteractiveMap day={resolvedDay} apiKey="browser-key" />)

    expect(screen.getByLabelText('Interactive map for day 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Map marker 1' }))

    expect(screen.getByTestId('map-info-window')).toHaveTextContent('Tokyo Station')
    expect(screen.getByRole('link', { name: /open in google maps/i })).toHaveAttribute('href', expect.stringContaining('place-tokyo'))
  })

  it('opens and closes the full-screen map dialog', () => {
    render(<InteractiveMap day={resolvedDay} apiKey="browser-key" />)

    fireEvent.click(screen.getByRole('button', { name: /open map/i }))
    const dialog = screen.getByRole('dialog', { name: 'Full-screen map for day 1' })
    expect(dialog).toBeInTheDocument()
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(document.body).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getAllByText('Tokyo Station')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close full-screen map' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body).toHaveStyle({ overflow: '' })
  })
})
