import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { useEffect, useRef, useState } from 'react'

import 'react-day-picker/style.css'

type DatePickerProps = {
  label: string
  value: string
  onChange: (value: string) => void
  minDate?: string
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateLabel(value: string): string {
  const date = parseDate(value)
  if (!date) return 'Select date'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function DatePicker({ label, value, onChange, minDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selected = parseDate(value)
  const minimumDate = parseDate(minDate ?? '')

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    if (isOpen) document.addEventListener('pointerdown', closeWhenClickingOutside)
    return () => document.removeEventListener('pointerdown', closeWhenClickingOutside)
  }, [isOpen])

  return (
    <div className="date-picker" ref={pickerRef}>
      <button
        className={value ? 'field__control date-picker__trigger' : 'field__control date-picker__trigger date-picker__trigger--empty'}
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <CalendarDays size={18} />
        <span>{dateLabel(value)}</span>
        <ChevronDown size={17} />
      </button>
      {isOpen && (
        <div className="date-picker__popover" role="dialog" aria-label={`${label} calendar`}>
          <DayPicker
            mode="single"
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected ?? minimumDate ?? new Date()}
            disabled={minimumDate ? { before: minimumDate } : undefined}
            onSelect={(date) => {
              if (!date) return
              onChange(toDateValue(date))
              setIsOpen(false)
            }}
          />
          {value && (
            <button className="date-picker__clear" type="button" onClick={() => { onChange(''); setIsOpen(false) }}>
              <X size={14} /> Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
