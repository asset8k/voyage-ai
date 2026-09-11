import { ArrowLeft, Compass, MapPin, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { TripPlanDisplay } from '../components/TripPlanDisplay'
import { ApiError, getTrip } from '../lib/api'
import { formatDateRange } from '../lib/formatting'
import type { TripDetail } from '../types/api'

export function PublicTripPage() {
  const { tripId } = useParams()
  const parsedTripId = Number(tripId)
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    if (!Number.isInteger(parsedTripId) || parsedTripId < 1) return

    async function loadTrip() {
      setError(null)
      setIsFetching(true)
      try {
        setTrip(await getTrip(parsedTripId))
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : 'We could not load this public journey. Please try again.')
      } finally {
        setIsFetching(false)
      }
    }

    void loadTrip()
  }, [parsedTripId])

  if (!Number.isInteger(parsedTripId) || parsedTripId < 1) return <Navigate replace to="/explore" />
  if (isFetching) return <section className="status-page"><Sparkles size={22} /><p>Opening this journey…</p></section>
  if (!trip) return <section className="dashboard-message card" role="alert"><h1>Journey unavailable</h1><p>{error ?? 'This journey is no longer public.'}</p><Link className="button button--secondary" to="/explore">Back to explore</Link></section>

  const planPrompt = (
    <section className="public-plan-callout card">
      <p className="eyebrow">Inspired?</p><h2>Make a journey your own.</h2><p>Start with your dates, budget, and travel style to create a new personal itinerary.</p>
      <Link className="button button--full" to="/"><Sparkles size={16} />Plan a trip</Link>
    </section>
  )

  return (
    <section className="itinerary-page public-itinerary-page">
      <Link className="back-link" to="/explore"><ArrowLeft size={16} />Explore journeys</Link>
      <div className="itinerary-hero public-itinerary-hero"><div className="itinerary-hero__wash" /><div className="itinerary-hero__content"><p className="eyebrow eyebrow--light"><Compass size={14} />Public journey</p><h1>{trip.title}</h1><p><MapPin size={16} />{trip.destination} · {formatDateRange(trip.start_date, trip.end_date)}</p></div></div>
      <TripPlanDisplay tripPlan={trip.trip_plan} sideContent={planPrompt} beforeSchedule={<section className="trip-intro card"><p>{trip.trip_plan.trip_summary}</p><div className="trip-intro__facts"><span><Compass size={16} />Shared with the Voyage AI community</span></div></section>} />
    </section>
  )
}
