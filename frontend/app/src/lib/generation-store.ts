import type { GeneratedTrip } from '../types/api'

const GENERATED_TRIP_KEY = 'voyage-ai.generated-trip'

export function saveGeneratedTrip(trip: GeneratedTrip): void {
  sessionStorage.setItem(GENERATED_TRIP_KEY, JSON.stringify(trip))
}

export function readGeneratedTrip(): GeneratedTrip | null {
  const storedTrip = sessionStorage.getItem(GENERATED_TRIP_KEY)
  if (!storedTrip) return null

  try {
    return JSON.parse(storedTrip) as GeneratedTrip
  } catch {
    sessionStorage.removeItem(GENERATED_TRIP_KEY)
    return null
  }
}
