import type { GeneratedTrip, TripDetail, User } from '../types/api'

export const userFixture: User = {
  id: 1,
  username: 'traveler_1',
  created_at: '2026-09-11T10:00:00Z',
}

export const generatedTripFixture: GeneratedTrip = {
  request: {
    destination: 'Tokyo',
    start_date: '2026-10-10',
    end_date: '2026-10-12',
    budget: 1000,
    currency: 'USD',
    travellers: 1,
    travel_pace: 'balanced',
    preferences: 'Food and museums',
  },
  tripPlan: {
    destination: 'Tokyo',
    trip_summary: 'A short Tokyo trip focused on food and museums.',
    currency: 'USD',
    days: [{
      day: 1,
      date: '2026-10-10',
      title: 'Arrival day',
      weather_note: null,
      estimated_daily_cost: 10,
      activities: [{
        start_time: '09:00',
        end_time: '10:00',
        name: 'Breakfast',
        description: 'Breakfast near the hotel.',
        location: 'Tokyo',
        map_queries: [],
        category: 'food',
        estimated_cost: 10,
        travel_time_to_next: null,
        resolved_places: [],
      }],
    }],
    budget: {
      accommodation: 0,
      food: 10,
      transport: 0,
      activities: 0,
      other: 0,
      total: 10,
    },
    recommendations: [],
    warnings: [],
    packing_tips: [],
    assumptions: [],
  },
}

export const savedTripFixture: TripDetail = {
  id: 10,
  title: 'Tokyo food notes',
  destination: 'Tokyo',
  start_date: '2026-10-10',
  end_date: '2026-10-12',
  trip_plan: generatedTripFixture.tripPlan,
  is_public: false,
  created_at: '2026-09-11T10:00:00Z',
  updated_at: '2026-09-11T10:00:00Z',
}
