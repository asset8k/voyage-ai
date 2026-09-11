import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useMap,
} from '@vis.gl/react-google-maps'
import { Expand, ExternalLink, MapPin, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'

import type { DayPlan, ResolvedPlace } from '../types/api'

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

type MapStop = {
  place: ResolvedPlace
  activityName: string
  startTime: string
}

type GoogleMapCanvasProps = {
  stops: MapStop[]
  fullScreen?: boolean
}

function mapStopsForDay(day: DayPlan): MapStop[] {
  const seen = new Set<string>()

  return day.activities.flatMap((activity) => activity.resolved_places.flatMap((place) => {
    if (seen.has(place.place_id)) return []
    seen.add(place.place_id)
    return [{ place, activityName: activity.name, startTime: activity.start_time }]
  }))
}

function googleMapsUrl(place: ResolvedPlace) {
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}&query_place_id=${place.place_id}`
}

function FitToStops({ stops }: { stops: MapStop[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || stops.length === 0) return

    const latitudes = stops.map(({ place }) => place.latitude)
    const longitudes = stops.map(({ place }) => place.longitude)
    const bounds = {
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    }
    map.fitBounds(bounds, 54)

    if (stops.length === 1) map.setZoom(15)
  }, [map, stops])

  return null
}

function GoogleMapCanvas({ stops, fullScreen = false }: GoogleMapCanvasProps) {
  const [activeStop, setActiveStop] = useState<MapStop | null>(null)
  const firstStop = stops[0]

  return (
    <Map
      className={fullScreen ? 'google-map google-map--full' : 'google-map'}
      defaultCenter={{ lat: firstStop.place.latitude, lng: firstStop.place.longitude }}
      defaultZoom={14}
      gestureHandling="greedy"
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      clickableIcons={false}
      onClick={() => setActiveStop(null)}
    >
      <FitToStops stops={stops} />
      {stops.map((stop, index) => (
        <Marker
          key={stop.place.place_id}
          position={{ lat: stop.place.latitude, lng: stop.place.longitude }}
          label={{ text: String(index + 1), color: '#ffffff', fontWeight: '700' }}
          onClick={() => setActiveStop(stop)}
        />
      ))}
      {activeStop && (
        <InfoWindow
          position={{ lat: activeStop.place.latitude, lng: activeStop.place.longitude }}
          onCloseClick={() => setActiveStop(null)}
        >
          <div className="map-info-window">
            <strong>{activeStop.place.name}</strong>
            <span>{activeStop.startTime} · {activeStop.activityName}</span>
            <a href={googleMapsUrl(activeStop.place)} target="_blank" rel="noreferrer">
              Open in Google Maps <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </InfoWindow>
      )}
    </Map>
  )
}

function MapDialog({ day, stops, onClose }: { day: DayPlan; stops: MapStop[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function closeOnBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <div className="map-dialog-backdrop" onMouseDown={closeOnBackdrop}>
      <div
        ref={dialogRef}
        className="map-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Full-screen map for day ${day.day}`}
        tabIndex={-1}
        onKeyDown={closeOnEscape}
      >
        <header className="map-dialog__header">
          <div>
            <span className="eyebrow">Day {day.day} route</span>
            <h2>{day.title}</h2>
          </div>
          <button className="map-dialog__close" type="button" onClick={onClose} aria-label="Close full-screen map">
            <X aria-hidden="true" />
          </button>
        </header>
        <GoogleMapCanvas stops={stops} fullScreen />
        <footer className="map-dialog__stops" aria-label="Mapped stops">
          {stops.map(({ place, activityName, startTime }, index) => (
            <a key={place.place_id} href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
              <span>{index + 1}</span>
              <div>
                <strong>{place.name}</strong>
                <small>{startTime} · {activityName}</small>
              </div>
              <ExternalLink aria-hidden="true" />
            </a>
          ))}
        </footer>
      </div>
    </div>
  )
}

export function InteractiveMap({ day, apiKey = mapsApiKey }: { day: DayPlan; apiKey?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const stops = mapStopsForDay(day)

  if (stops.length === 0) {
    return <div className="interactive-map__empty"><MapPin aria-hidden="true" /><span>No map-ready stops for this day yet.</span></div>
  }

  if (!apiKey) {
    return (
      <div className="interactive-map__empty interactive-map__empty--setup">
        <MapPin aria-hidden="true" />
        <span>Google Maps will appear after its browser key is configured.</span>
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey} language="en" region="US">
      <section className="interactive-map__region" aria-label={`Interactive map for day ${day.day}`}>
        <div className="interactive-map__toolbar">
          <span><MapPin aria-hidden="true" /> {stops.length} mapped {stops.length === 1 ? 'place' : 'places'}</span>
          <button type="button" onClick={() => setIsExpanded(true)}>
            <Expand aria-hidden="true" /> Open map
          </button>
        </div>
        <GoogleMapCanvas stops={stops} />
      </section>
      {isExpanded && <MapDialog day={day} stops={stops} onClose={() => setIsExpanded(false)} />}
    </APIProvider>
  )
}
