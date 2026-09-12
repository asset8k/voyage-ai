import type { DayPlan, ResolvedPlace } from '../types/api'

export type MapStop = {
  place: ResolvedPlace
  activityName: string
  startTime: string
}

export function getUniqueMapStops(day: DayPlan): MapStop[] {
  const seen = new Set<string>()

  return day.activities.flatMap((activity) => activity.resolved_places.flatMap((place) => {
    if (seen.has(place.place_id)) return []
    seen.add(place.place_id)
    return [{ place, activityName: activity.name, startTime: activity.start_time }]
  }))
}
