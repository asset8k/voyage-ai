import {
  CalendarDays,
  ChevronDown,
  FileText,
  MapPin,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, generateTrip } from '../lib/api'
import { saveGeneratedTrip } from '../lib/generation-store'
import type { TravelPace, TripGenerationRequest } from '../types/api'

const allowedFileTypes = ['image/jpeg', 'image/png', 'application/pdf']
const maxFileSize = 10 * 1024 * 1024

const initialForm: TripGenerationRequest = {
  destination: '',
  start_date: '',
  end_date: '',
  budget: 1500,
  currency: 'USD',
  travellers: 1,
  travel_pace: 'balanced',
  preferences: '',
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 1 : 0)} MB`
}

export function PlanTripPage() {
  const [form, setForm] = useState<TripGenerationRequest>(initialForm)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  function updateField<K extends keyof TripGenerationRequest>(key: K, value: TripGenerationRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addFiles(uploadedFiles: FileList | null) {
    if (!uploadedFiles) return
    const newFiles = Array.from(uploadedFiles)
    const invalidFile = newFiles.find((file) => !allowedFileTypes.includes(file.type) || file.size > maxFileSize)

    if (invalidFile) {
      setError('Attachments must be JPG, PNG, or PDF files no larger than 10 MB.')
      return
    }
    if (files.length + newFiles.length > 3) {
      setError('You can attach up to three files.')
      return
    }
    setFiles((current) => [...current, ...newFiles])
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (form.end_date <= form.start_date) {
      setError('Your end date must be after your start date.')
      return
    }

    setIsSubmitting(true)
    try {
      const tripPlan = await generateTrip(form, files)
      saveGeneratedTrip({ request: form, tripPlan })
      navigate('/generated')
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'We could not create your itinerary. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="planner-page">
      <div className="planner-hero">
        <div className="planner-hero__copy">
          <p className="eyebrow eyebrow--light"><Sparkles size={14} /> Personal travel concierge</p>
          <h1>Make your next trip feel unmistakably yours.</h1>
          <p>Give Voyage AI the essentials and it will shape a considered itinerary, practical budget, and places worth remembering.</p>
        </div>
        <div className="planner-hero__postcard" aria-hidden="true">
          <span>WHERE TO?</span><MapPin size={28} /><strong>Go somewhere<br />worth lingering.</strong>
        </div>
      </div>

      <form className="trip-form card" onSubmit={handleSubmit}>
        <div className="form-heading">
          <div><p className="eyebrow">Start planning</p><h2>Tell us about your trip</h2></div>
          <span className="form-heading__step">01 / 01</span>
        </div>

        <div className="form-grid form-grid--three">
          <label className="field field--wide"><span>Destination</span><div className="field__control"><MapPin size={18} /><input required maxLength={120} placeholder="Paris, France" value={form.destination} onChange={(event) => updateField('destination', event.target.value)} /></div></label>
          <label className="field"><span>Arrival</span><div className="field__control"><CalendarDays size={18} /><input required type="date" value={form.start_date} onChange={(event) => updateField('start_date', event.target.value)} /></div></label>
          <label className="field"><span>Departure</span><div className="field__control"><CalendarDays size={18} /><input required type="date" value={form.end_date} onChange={(event) => updateField('end_date', event.target.value)} /></div></label>
        </div>

        <div className="form-grid form-grid--four">
          <label className="field"><span>Total budget</span><div className="field__control"><span className="field__prefix">{form.currency}</span><input required min="1" type="number" value={form.budget} onChange={(event) => updateField('budget', Number(event.target.value))} /></div></label>
          <label className="field"><span>Currency</span><div className="field__control field__control--select"><select value={form.currency} onChange={(event) => updateField('currency', event.target.value.toUpperCase())}><option>USD</option><option>EUR</option><option>GBP</option><option>KZT</option></select><ChevronDown size={17} /></div></label>
          <label className="field"><span>Travellers</span><div className="field__control"><Users size={18} /><input required min="1" type="number" value={form.travellers} onChange={(event) => updateField('travellers', Number(event.target.value))} /></div></label>
          <label className="field"><span>Travel pace</span><div className="field__control field__control--select"><select value={form.travel_pace} onChange={(event) => updateField('travel_pace', event.target.value as TravelPace)}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="fast">Fast</option></select><ChevronDown size={17} /></div></label>
        </div>

        <label className="field"><span>What would make this trip great?</span><textarea required maxLength={1024} rows={5} placeholder="Tell us what you enjoy, the rhythm you want, food you are curious about, places you have saved, or anything else that matters." value={form.preferences} onChange={(event) => updateField('preferences', event.target.value)} /><small>{form.preferences.length}/1024</small></label>

        <div className="attachment-section">
          <div><span className="field-label">Inspiration, if you have it</span><p>Add up to 3 JPG, PNG, or PDF files. They are used only to plan this trip.</p></div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
          <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()}><FileText size={17} />Add files</button>
        </div>

        {files.length > 0 && <ul className="attachment-list" aria-label="Selected attachments">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><FileText size={17} /><span>{file.name}</span><small>{formatFileSize(file.size)}</small><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X size={16} /></button></li>)}</ul>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-footer"><p>Generation can take a little while when live weather, exchange rates, and places are checked.</p><button className="button button--large" disabled={isSubmitting} type="submit"><Sparkles size={18} />{isSubmitting ? 'Creating your itinerary…' : 'Create my journey'}</button></div>
      </form>
    </section>
  )
}
