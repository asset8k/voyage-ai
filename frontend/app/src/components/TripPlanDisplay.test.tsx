import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { generatedTripFixture } from '../test/fixtures'
import { getUniqueMapStops } from './map-stops'
import { TripPlanDisplay } from './TripPlanDisplay'

describe('TripPlanDisplay', () => {
  it('renders Good to know entries as a readable bullet list', () => {
    const tripPlan = {
      ...generatedTripFixture.tripPlan,
      warnings: ['Museum hours can change.'],
      assumptions: ['Costs are estimated for one traveller.'],
      packing_tips: ['Wear comfortable walking shoes.'],
    }

    render(<TripPlanDisplay tripPlan={tripPlan} />)

    const advisory = screen.getByRole('heading', { name: 'Good to know' }).closest('section')
    expect(advisory).not.toBeNull()
    expect(within(advisory as HTMLElement).getByRole('list')).toHaveTextContent('Museum hours can change.')
    expect(within(advisory as HTMLElement).getByRole('list')).toHaveTextContent('Costs are estimated for one traveller.')
  })

  it('uses each resolved place once when an arrival and visit share a location', () => {
    const place = {
      provider: 'google_places' as const,
      place_id: 'tiananmen-square',
      name: 'Tiananmen Square',
      formatted_address: 'Dongcheng, Beijing',
      latitude: 39.904,
      longitude: 116.397,
      photo_reference: null,
    }
    const day = {
      ...generatedTripFixture.tripPlan.days[0],
      activities: generatedTripFixture.tripPlan.days[0].activities.slice(0, 2).map((activity) => ({ ...activity, resolved_places: [place] })),
    }

    expect(getUniqueMapStops(day)).toEqual([{ place, activityName: day.activities[0].name, startTime: day.activities[0].start_time }])
  })
})
