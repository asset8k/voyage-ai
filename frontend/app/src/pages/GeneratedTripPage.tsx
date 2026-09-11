import { ArrowRight, CircleDollarSign, MapPin, Sparkles, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { TripPlanDisplay } from '../components/TripPlanDisplay'
import { ApiError, saveTrip } from '../lib/api'
import { formatDateRange, formatMoney } from '../lib/formatting'
import { readGeneratedTrip } from '../lib/generation-store'
import type { TripDetail } from '../types/api'

export function GeneratedTripPage() {
  const generatedTrip = readGeneratedTrip()
  const [title, setTitle] = useState('')
  const [savedTrip, setSavedTrip] = useState<TripDetail | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { accessToken, isLoading, user } = useAuth()
  const navigate = useNavigate()

  if (!generatedTrip) return <Navigate replace to="/" />

  const { request, tripPlan } = generatedTrip

  async function handleSave() {
    if (!accessToken) {
      navigate('/auth', { state: { from: '/generated' } })
      return
    }

    setSaveError(null)
    setIsSaving(true)
    try {
      setSavedTrip(await saveTrip({
        title: title.trim() || null,
        generation_request: request,
        trip_plan: tripPlan,
      }, accessToken))
    } catch (requestError) {
      setSaveError(requestError instanceof ApiError ? requestError.message : 'We could not save this trip. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const savePanel = savedTrip ? (
    <section className="save-callout card">
      <p className="eyebrow">Saved privately</p>
      <h2>{savedTrip.title} is in your library.</h2>
      <p>You can now edit, publish, and refine this itinerary from My Trips.</p>
      <Link className="button button--full" to={`/my-trips/${savedTrip.id}`}>Open saved trip<ArrowRight size={17} /></Link>
    </section>
  ) : (
    <section className="save-callout card">
      <p className="eyebrow">Keep this plan</p>
      <h2>{user ? 'Save it to your trips.' : 'Save it to make it yours.'}</h2>
      <p>{isLoading ? 'Checking your session…' : user ? 'Choose a title or keep the destination default. Saved trips start private.' : 'Sign in to save this itinerary, make it public, and refine it later.'}</p>
      {user ? <>
        <label className="save-title" htmlFor="saved-trip-title"><span>Trip title (optional)</span><input id="saved-trip-title" placeholder={`${tripPlan.destination} trip`} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        {saveError && <p className="save-error" role="alert">{saveError}</p>}
        <button className="button button--full" type="button" disabled={isSaving} onClick={handleSave}>{isSaving ? 'Saving…' : 'Save trip'}<ArrowRight size={17} /></button>
      </> : <button className="button button--full" type="button" disabled={isLoading} onClick={handleSave}>Sign in to save<ArrowRight size={17} /></button>}
    </section>
  )

  return (
    <section className="itinerary-page">
      <div className="itinerary-hero"><div className="itinerary-hero__wash" /><div className="itinerary-hero__content"><p className="eyebrow eyebrow--light"><Sparkles size={14} />Your AI-crafted journey</p><h1>{tripPlan.destination}</h1><p><MapPin size={16} />{formatDateRange(request.start_date, request.end_date)}</p></div></div>
      <TripPlanDisplay
        tripPlan={tripPlan}
        sideContent={savePanel}
        beforeSchedule={<section className="trip-intro card"><p>{tripPlan.trip_summary}</p><div className="trip-intro__facts"><span><UserRound size={16} />{request.travellers} traveller{request.travellers === 1 ? '' : 's'}</span><span><Sparkles size={16} />{request.travel_pace} pace</span><span><CircleDollarSign size={16} />{formatMoney(tripPlan.budget.total, tripPlan.currency)} estimated</span></div></section>}
      />
    </section>
  )
}
