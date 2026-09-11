export type TravelPace = 'relaxed' | 'balanced' | 'fast'

export type TripGenerationRequest = {
  destination: string
  start_date: string
  end_date: string
  budget: number
  currency: string
  travellers: number
  travel_pace: TravelPace
  preferences: string
}

export type ResolvedPlace = {
  provider: 'google_places'
  place_id: string
  name: string
  formatted_address: string | null
  latitude: number
  longitude: number
  photo_reference: string | null
}

export type Activity = {
  start_time: string
  end_time: string
  name: string
  description: string
  location: string
  map_queries: string[]
  category: string
  estimated_cost: number
  travel_time_to_next: string | null
  resolved_places: ResolvedPlace[]
}

export type DayPlan = {
  day: number
  date: string
  title: string
  weather_note: string | null
  activities: Activity[]
  estimated_daily_cost: number
}

export type BudgetBreakdown = {
  accommodation: number
  food: number
  transport: number
  activities: number
  other: number
  total: number
}

export type TripPlan = {
  destination: string
  trip_summary: string
  days: DayPlan[]
  budget: BudgetBreakdown
  recommendations: string[]
  warnings: string[]
  packing_tips: string[]
  assumptions: string[]
  currency: string
}

export type GeneratedTrip = {
  request: TripGenerationRequest
  tripPlan: TripPlan
}

export type User = {
  id: number
  username: string
  created_at: string
}

export type Credentials = {
  username: string
  password: string
}

export type TokenResponse = {
  access_token: string
  token_type: 'bearer'
}

export type TripDetail = {
  id: number
  title: string
  destination: string
  start_date: string
  end_date: string
  trip_plan: TripPlan
  is_public: boolean
  created_at: string
  updated_at: string
}

export type TripCreate = {
  title: string | null
  generation_request: TripGenerationRequest
  trip_plan: TripPlan
}

export type TripListItem = {
  id: number
  title: string
  destination: string
  start_date: string
  end_date: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export type TripUpdate = {
  title?: string
  is_public?: boolean
}

export type TripRefinementRequest = {
  instruction: string
}

export type PublicUser = {
  id: number
  username: string
}

export type TripFeedItem = {
  id: number
  title: string
  destination: string
  start_date: string
  end_date: string
  trip_summary: string
  author: PublicUser
  created_at: string
}
