import { Compass, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="placeholder-page not-found-page">
      <span className="placeholder-page__icon"><Compass size={26} /></span>
      <p className="eyebrow">404 · Off the itinerary</p>
      <h1>We could not find that page.</h1>
      <p>This route may have moved, or the journey is no longer available.</p>
      <Link className="button" to="/"><Home size={16} />Plan a trip</Link>
    </section>
  )
}
