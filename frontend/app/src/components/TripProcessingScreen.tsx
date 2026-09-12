import { Compass, LoaderCircle, MapPin, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

type ProcessingMode = 'generation' | 'refinement'

const workingMessages: Record<ProcessingMode, string[]> = {
  generation: [
    'Considering the details that matter most to you',
    'Building a route with room to enjoy each day',
    'Checking practical details around your trip',
    'Shaping the finishing touches of your itinerary',
  ],
  refinement: [
    'Considering how your instruction changes the plan',
    'Reworking the route without changing your trip settings',
    'Balancing the revised days and costs',
    'Polishing the updated itinerary for you',
  ],
}

export function TripProcessingScreen({ mode }: { mode: ProcessingMode }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const title = mode === 'generation' ? 'Creating your itinerary' : 'Refining your itinerary'
  const message = workingMessages[mode][messageIndex]

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % workingMessages[mode].length)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [mode])

  return (
    <section className="processing-screen" aria-busy="true" aria-live="polite">
      <div className="processing-screen__card">
        <div className="processing-screen__visual" aria-hidden="true">
          <span className="processing-screen__route" />
          <span className="processing-screen__route-dot" />
          <span className="processing-screen__place processing-screen__place--start"><MapPin /></span>
          <span className="processing-screen__place processing-screen__place--end"><Sparkles /></span>
          <span className="processing-screen__orb"><Compass /><span /></span>
        </div>
        <h1>{title}</h1>
        <div className="processing-screen__status" role="status">
          <span><LoaderCircle aria-hidden="true" /></span>
          <strong key={message}>{message}</strong>
        </div>
        <div className="processing-screen__progress" aria-hidden="true"><span /></div>
        <p className="processing-screen__hint">This can take a moment.</p>
      </div>
    </section>
  )
}
