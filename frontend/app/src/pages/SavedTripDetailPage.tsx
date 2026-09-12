import { ArrowLeft, Globe2, Lightbulb, LockKeyhole, MapPin, Pencil, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { TripPlanDisplay } from '../components/TripPlanDisplay'
import { TripProcessingScreen } from '../components/TripProcessingScreen'
import { useToast } from '../components/toast-context'
import { ApiError, deleteTrip, getTrip, refineTrip, updateTrip } from '../lib/api'
import { formatDateRange } from '../lib/formatting'
import type { TripDetail } from '../types/api'

export function SavedTripDetailPage() {
  const { tripId } = useParams()
  const parsedTripId = Number(tripId)
  const { accessToken, isLoading, user } = useAuth()
  const { success } = useToast()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [hasJustRefined, setHasJustRefined] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const token = accessToken
    if (!token || !Number.isInteger(parsedTripId) || parsedTripId < 1) return

    async function loadTrip() {
      if (!token) return
      setError(null)
      setIsFetching(true)
      try {
        const loadedTrip = await getTrip(parsedTripId, token)
        setTrip(loadedTrip)
        setTitle(loadedTrip.title)
        setIsPublic(loadedTrip.is_public)
      } catch (requestError) {
        setError(requestError instanceof ApiError ? requestError.message : 'We could not load this trip. Please try again.')
      } finally {
        setIsFetching(false)
      }
    }

    void loadTrip()
  }, [accessToken, parsedTripId])

  if (isLoading) return <section className="status-page"><Sparkles size={22} /><p>Loading your journey…</p></section>
  if (!user || !accessToken) return <Navigate replace to="/auth" state={{ from: `/my-trips/${tripId ?? ''}` }} />
  if (!Number.isInteger(parsedTripId) || parsedTripId < 1) return <Navigate replace to="/my-trips" />
  const token = accessToken

  async function handleSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trip) return

    setError(null)
    setIsUpdating(true)
    try {
      const updatedTrip = await updateTrip(trip.id, { title: title.trim(), is_public: isPublic }, token)
      setTrip(updatedTrip)
      setTitle(updatedTrip.title)
      setIsPublic(updatedTrip.is_public)
      success('Changes saved', updatedTrip.is_public ? 'This itinerary is now visible in the public feed.' : 'This itinerary remains private to your account.')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'We could not update this trip. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleRefinement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trip || !instruction.trim()) return

    setError(null)
    setIsRefining(true)
    try {
      const refinedTrip = await refineTrip(trip.id, { instruction: instruction.trim() }, token)
      setTrip(refinedTrip)
      setInstruction('')
      setHasJustRefined(true)
      success('Itinerary refined', 'Your revised plan is ready to explore.')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'We could not refine this trip. Please try again.')
    } finally {
      setIsRefining(false)
    }
  }

  async function handleDelete() {
    if (!trip || !window.confirm(`Delete “${trip.title}”? This cannot be undone.`)) return

    setError(null)
    setIsDeleting(true)
    try {
      await deleteTrip(trip.id, token)
      success('Trip deleted', 'It has been removed from your library and the feed.')
      navigate('/my-trips', { replace: true })
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'We could not delete this trip. Please try again.')
      setIsDeleting(false)
    }
  }

  if (isFetching) return <section className="status-page"><Sparkles size={22} /><p>Loading your itinerary…</p></section>
  if (!trip) return <section className="dashboard-message card" role="alert"><h1>Trip unavailable</h1><p>{error ?? 'This trip may no longer exist.'}</p><Link className="button button--secondary" to="/my-trips">Back to my trips</Link></section>
  if (isRefining) return <TripProcessingScreen mode="refinement" />

  const managementPanel = <>
    <form className="trip-management card" onSubmit={handleSettingsSave}>
      <div className="trip-management__heading"><span><Pencil size={17} /></span><div><p className="eyebrow">Trip settings</p><h2>Make it yours</h2></div></div>
      <label className="field" htmlFor="trip-title"><span>Trip title</span><input id="trip-title" required minLength={1} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="visibility-control"><input id="trip-is-public" type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><label htmlFor="trip-is-public"><Globe2 size={17} /><strong>Show in the public feed</strong><small>Anyone can view a public itinerary.</small></label></div>
      <button className="button button--secondary button--full" disabled={isUpdating} type="submit"><Save size={16} />{isUpdating ? 'Saving…' : 'Save changes'}</button>
    </form>
    <form className="refine-card card" onSubmit={handleRefinement}>
      <div className="trip-management__heading"><span><Lightbulb size={17} /></span><div><p className="eyebrow">AI refinement</p><h2>Adjust the itinerary</h2></div></div>
      <label className="field" htmlFor="refinement-instruction"><span>What should change?</span><textarea id="refinement-instruction" required maxLength={1000} rows={4} placeholder="Make day two slower and add more local food." value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label>
      <p className="refine-card__note">Refinement updates the itinerary, while preserving the original destination, dates, travellers, currency, and budget.</p>
      <button className="button button--full" disabled={isRefining} type="submit"><Sparkles size={16} />{isRefining ? 'Refining itinerary…' : 'Refine with AI'}</button>
    </form>
    <section className="danger-card card"><div><Trash2 size={17} /><div><h2>Delete this trip</h2><p>It will be removed from your library and the feed.</p></div></div><button type="button" disabled={isDeleting} onClick={handleDelete}>{isDeleting ? 'Deleting…' : 'Delete trip'}</button></section>
  </>

  return (
    <section className={`itinerary-page saved-itinerary-page${hasJustRefined ? ' itinerary-page--arrival' : ''}`}>
      <Link className="back-link" to="/my-trips"><ArrowLeft size={16} />My trips</Link>
      <div className="itinerary-hero"><div className="itinerary-hero__wash" /><div className="itinerary-hero__content"><p className="eyebrow eyebrow--light"><LockKeyhole size={14} />Your saved itinerary</p><h1>{trip.title}</h1><p><MapPin size={16} />{trip.destination} · {formatDateRange(trip.start_date, trip.end_date)}</p></div></div>
      {error && <p className="form-error saved-itinerary-page__error" role="alert">{error}</p>}
      <TripPlanDisplay tripPlan={trip.trip_plan} sideContent={managementPanel} beforeSchedule={<section className="trip-intro card"><p>{trip.trip_plan.trip_summary}</p><div className="trip-intro__facts"><span>{trip.is_public ? <Globe2 size={16} /> : <LockKeyhole size={16} />}{trip.is_public ? 'Visible in the public feed' : 'Private to your account'}</span><span>Last updated {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(trip.updated_at))}</span></div></section>} />
    </section>
  )
}
