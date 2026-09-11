import { ArrowRight, Globe2, LockKeyhole, MapPin, Plus, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { ApiError, getMyTrips } from '../lib/api'
import type { TripListItem } from '../types/api'
import { formatDateRange } from '../lib/formatting'

function SavedTripCard({ trip }: { trip: TripListItem }) {
  return (
    <article className="saved-trip-card card">
      <div className="saved-trip-card__topline">
        <span className={trip.is_public ? 'visibility-badge visibility-badge--public' : 'visibility-badge'}>
          {trip.is_public ? <Globe2 size={13} /> : <LockKeyhole size={13} />}
          {trip.is_public ? 'Public' : 'Private'}
        </span>
        <span>Saved {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${trip.created_at}`))}</span>
      </div>
      <div className="saved-trip-card__destination"><MapPin size={18} /><span>{trip.destination}</span></div>
      <h2>{trip.title}</h2>
      <p>{formatDateRange(trip.start_date, trip.end_date)}</p>
      <Link className="saved-trip-card__link" to={`/my-trips/${trip.id}`}>Open itinerary <ArrowRight size={16} /></Link>
    </article>
  )
}

export function MyTripsPage() {
  const { accessToken, isLoading, user } = useAuth()
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    const token = accessToken
    if (!token) return

    async function loadTrips() {
      if (!token) return
      setError(null)
      setIsFetching(true)
      try {
        setTrips(await getMyTrips(token))
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : 'We could not load your trips. Please try again.')
      } finally {
        setIsFetching(false)
      }
    }

    void loadTrips()
  }, [accessToken])

  if (isLoading) return <section className="status-page"><Sparkles size={22} /><p>Loading your journeys…</p></section>
  if (!user || !accessToken) return <Navigate replace to="/auth" state={{ from: '/my-trips' }} />

  return (
    <section className="dashboard-page">
      <header className="dashboard-hero">
        <div><p className="eyebrow eyebrow--light">Your private library</p><h1>Journeys, kept close.</h1><p>Pick up an itinerary, make it public when you are ready, or ask Voyage AI to refine the details.</p></div>
        <Link className="button dashboard-hero__button" to="/"><Plus size={17} />Create a journey</Link>
      </header>
      <div className="dashboard-heading"><div><p className="eyebrow">@{user.username}</p><h2>My trips</h2></div>{!isFetching && <span>{trips.length} saved {trips.length === 1 ? 'trip' : 'trips'}</span>}</div>
      {isFetching ? <section className="status-page card"><Sparkles size={22} /><p>Loading your saved trips…</p></section> : error ? <section className="dashboard-message card" role="alert"><h2>We could not load your trips.</h2><p>{error}</p><button className="button button--secondary" type="button" onClick={() => window.location.reload()}>Try again</button></section> : trips.length === 0 ? <section className="empty-library card"><span><Sparkles size={24} /></span><h2>Your library is waiting.</h2><p>Generate an itinerary and save it to return here anytime.</p><Link className="button" to="/">Plan a trip <ArrowRight size={17} /></Link></section> : <div className="saved-trip-grid">{trips.map((trip) => <SavedTripCard key={trip.id} trip={trip} />)}</div>}
    </section>
  )
}
