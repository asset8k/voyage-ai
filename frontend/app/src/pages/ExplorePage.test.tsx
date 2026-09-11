import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { savedTripFixture } from '../test/fixtures'
import { ExplorePage } from './ExplorePage'
import { PublicTripPage } from './PublicTripPage'

describe('public exploration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads public trips without requiring a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 10,
      title: 'Tokyo food notes',
      destination: 'Tokyo',
      start_date: '2026-10-10',
      end_date: '2026-10-12',
      trip_summary: 'A short Tokyo trip focused on food and museums.',
      author: { id: 1, username: 'traveler_1' },
      created_at: '2026-09-11T10:00:00Z',
    }])))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <Routes><Route path="/explore" element={<ExplorePage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Tokyo food notes')).toBeInTheDocument()
    expect(screen.getByText('@traveler_1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view journey/i })).toHaveAttribute('href', '/trips/10')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/trips/feed',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    )
  })

  it('renders a public itinerary without owner controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...savedTripFixture, is_public: true })))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/trips/10']}>
        <Routes><Route path="/trips/:tripId" element={<PublicTripPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Tokyo food notes')).toBeInTheDocument()
    expect(screen.getByText('Shared with the Voyage AI community')).toBeInTheDocument()
    expect(screen.queryByText('Trip settings')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/trips/10',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    )
  })
})
