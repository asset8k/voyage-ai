import {
  Clock3,
  Lightbulb,
  MapPin,
  Navigation,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { formatDate, formatMoney } from '../lib/formatting'
import type { Activity, BudgetBreakdown, DayPlan, TripPlan } from '../types/api'
import { InteractiveMap } from './InteractiveMap'
import { getUniqueMapStops } from './map-stops'

function BudgetSummary({ budget, currency }: { budget: BudgetBreakdown; currency: string }) {
  const items = [
    ['Accommodation', budget.accommodation, 'coral'],
    ['Food', budget.food, 'blue'],
    ['Transport', budget.transport, 'sky'],
    ['Activities', budget.activities, 'gold'],
    ['Other', budget.other, 'grey'],
  ] as const

  return (
    <section className="card budget-card">
      <div className="section-heading section-heading--compact">
        <div><p className="eyebrow">Financial summary</p><h2>Trip budget allocation</h2></div>
        <strong>{formatMoney(budget.total, currency)}</strong>
      </div>
      <div className="budget-bar" aria-label="Budget breakdown">
        {items.map(([label, amount, color]) => (
          <span
            key={label}
            className={`budget-bar__segment budget-bar__segment--${color}`}
            style={{ width: `${budget.total ? (amount / budget.total) * 100 : 0}%` }}
            title={`${label}: ${formatMoney(amount, currency)}`}
          />
        ))}
      </div>
      <div className="budget-legend">
        {items.map(([label, amount, color]) => (
          <div key={label}>
            <span className={`budget-dot budget-dot--${color}`} />
            <small>{label}</small>
            <strong>{formatMoney(amount, currency)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActivityCard({ activity, index, currency }: { activity: Activity; index: number; currency: string }) {
  const place = activity.resolved_places[0]

  return (
    <article className="activity-card">
      <span className="activity-card__number">{index + 1}</span>
      <div className="activity-card__body">
        <div className="activity-card__meta">
          <span className="category-tag">{activity.category}</span>
          <span><Clock3 size={14} /> {activity.start_time} – {activity.end_time}</span>
          <strong>{activity.estimated_cost === 0 ? 'Free' : formatMoney(activity.estimated_cost, currency)}</strong>
        </div>
        <h3>{activity.name}</h3>
        <p>{activity.description}</p>
        <div className="activity-card__location"><MapPin size={15} /><span>{place?.formatted_address ?? activity.location}</span></div>
        {activity.travel_time_to_next && <div className="activity-card__travel"><Navigation size={14} />{activity.travel_time_to_next} to the next stop</div>}
      </div>
    </article>
  )
}

function PlacesPanel({ day }: { day: DayPlan }) {
  const places = getUniqueMapStops(day)

  return (
    <aside className="places-panel">
      <div className="places-panel__map"><InteractiveMap day={day} /></div>
      <div className="places-panel__list">
        <p className="eyebrow">Map-ready places</p>
        {places.length === 0 ? <p className="muted-copy">This day has no specific map markers yet.</p> : places.map(({ place, activityName, startTime }) => (
          <div className="place-row" key={place.place_id}>
            <MapPin size={16} />
            <div><strong>{place.name}</strong><span>{startTime} · {place.formatted_address ?? activityName}</span></div>
          </div>
        ))}
      </div>
    </aside>
  )
}

type TripPlanDisplayProps = {
  tripPlan: TripPlan
  beforeSchedule?: ReactNode
  sideContent?: ReactNode
}

export function TripPlanDisplay({ tripPlan, beforeSchedule, sideContent }: TripPlanDisplayProps) {
  const [selectedDay, setSelectedDay] = useState(0)
  const day = tripPlan.days[selectedDay]

  return (
    <div className="itinerary-layout">
      <div className="itinerary-main">
        {beforeSchedule}
        <section className="day-switcher card">
          <div className="day-tabs" role="tablist" aria-label="Trip days">
            {tripPlan.days.map((item, index) => (
              <button key={item.day} className={index === selectedDay ? 'day-tab day-tab--active' : 'day-tab'} type="button" onClick={() => setSelectedDay(index)}>
                <span>Day {item.day}</span><small>{item.title}</small>
              </button>
            ))}
          </div>
          {day.weather_note && <div className="weather-note"><span>☀</span>{day.weather_note}</div>}
        </section>
        <section className="card itinerary-card">
          <div className="section-heading">
            <div><p className="eyebrow">Itinerary schedule</p><h2>{formatDate(day.date)} · {day.title}</h2></div>
            <span>{day.activities.length} stops · {formatMoney(day.estimated_daily_cost, tripPlan.currency)}</span>
          </div>
          <div className="activity-timeline">
            {day.activities.map((activity, index) => <ActivityCard key={`${activity.start_time}-${activity.name}`} activity={activity} index={index} currency={tripPlan.currency} />)}
          </div>
        </section>
        <BudgetSummary budget={tripPlan.budget} currency={tripPlan.currency} />
        {(tripPlan.warnings.length > 0 || tripPlan.assumptions.length > 0) && (
          <section className="card advisory-card"><TriangleAlert size={20} /><div><h2>Good to know</h2><ul>{[...tripPlan.warnings, ...tripPlan.assumptions].map((item) => <li key={item}>{item}</li>)}</ul></div></section>
        )}
        {tripPlan.packing_tips.length > 0 && (
          <section className="card tips-card"><Lightbulb size={20} /><div><h2>Packing tips</h2><ul>{tripPlan.packing_tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div></section>
        )}
      </div>
      <div className="itinerary-side"><PlacesPanel day={day} />{sideContent}</div>
    </div>
  )
}
