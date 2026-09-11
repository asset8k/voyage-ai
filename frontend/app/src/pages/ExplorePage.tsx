import { ArrowRight, Compass, MapPin, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, getPublicTrips } from '../lib/api'
import { formatDateRange } from '../lib/formatting'
import type { TripFeedItem } from '../types/api'

function FeedCard({ trip }: { trip: TripFeedItem }) {
  return (
    <article className="feed-card card">
      <div className="feed-card__topline"><span><Compass size={13} />Shared journey</span><span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(trip.created_at))}</span></div>
      <div className="feed-card__destination"><MapPin size={18} />{trip.destination}</div>
      <h2>{trip.title}</h2>
      <p>{trip.trip_summary}</p>
      <div className="feed-card__footer"><span><UserRound size={14} />@{trip.author.username}</span><Link to={`/trips/${trip.id}`}>View journey <ArrowRight size={15} /></Link></div>
      <span className="feed-card__dates">{formatDateRange(trip.start_date, trip.end_date)}</span>
    </article>
  )
}

export function ExplorePage() {
  const [trips, setTrips] = useState<TripFeedItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function loadFeed() {
      setError(null)
      setIsFetching(true)
      try {
        setTrips(await getPublicTrips())
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : 'We could not load the public journeys. Please try again.')
      } finally {
        setIsFetching(false)
      }
    }

    void loadFeed()
  }, [reloadKey])

  return (
    <section className="explore-page">
      <header className="explore-hero"><div><p className="eyebrow eyebrow--light">Public itinerary feed</p><h1>Find a new way to go.</h1><p>Explore journeys other travelers chose to share, then use the ideas to begin a plan of your own.</p></div><Link className="button explore-hero__button" to="/"><Sparkles size={17} />Plan my journey</Link></header>
      <div className="explore-heading"><div><p className="eyebrow">Community journeys</p><h2>Recently shared</h2></div>{!isFetching && <span>{trips.length} {trips.length === 1 ? 'journey' : 'journeys'}</span>}</div>
      {isFetching ? <section className="status-page card"><Sparkles size={22} /><p>Finding shared journeys…</p></section> : error ? <section className="dashboard-message card" role="alert"><h2>We could not load the feed.</h2><p>{error}</p><button className="button button--secondary" type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></section> : trips.length === 0 ? <section className="empty-library card"><span><Compass size={24} /></span><h2>The feed is quiet for now.</h2><p>Published trips will appear here once travelers choose to share them.</p><Link className="button" to="/">Create a journey <ArrowRight size={17} /></Link></section> : <div className="feed-grid">{trips.map((trip) => <FeedCard key={trip.id} trip={trip} />)}</div>}
    </section>
  )
}
