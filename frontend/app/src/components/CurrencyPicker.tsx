import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

const popularCurrencies = [
  ['USD', 'US Dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['JPY', 'Japanese Yen'],
  ['CAD', 'Canadian Dollar'],
  ['AUD', 'Australian Dollar'],
  ['CNY', 'Chinese Yuan'],
  ['KRW', 'South Korean Won'],
  ['TRY', 'Turkish Lira'],
  ['KZT', 'Kazakhstani Tenge'],
  ['AED', 'UAE Dirham'],
  ['THB', 'Thai Baht'],
  ['SGD', 'Singapore Dollar'],
] as const

type CurrencyPickerProps = {
  value: string
  onChange: (value: string) => void
}

export function CurrencyPicker({ value, onChange }: CurrencyPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const normalizedValue = value.toUpperCase()
  const filteredCurrencies = popularCurrencies.filter(([code, name]) => {
    const normalizedQuery = query.trim().toLowerCase()
    return !normalizedQuery || code.toLowerCase().includes(normalizedQuery) || name.toLowerCase().includes(normalizedQuery)
  })

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function selectCurrency(code: string) {
    onChange(code)
    setQuery('')
    setIsOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') setIsOpen(false)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
    }
  }

  return (
    <div className="currency-picker" ref={pickerRef}>
      <div className="field__control currency-picker__control">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Currency"
          className="currency-picker__input"
          maxLength={3}
          minLength={3}
          placeholder="USD"
          required
          role="combobox"
          value={normalizedValue}
          onChange={(event) => {
            onChange(event.target.value.toUpperCase())
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          aria-label="Show currency options"
          aria-expanded={isOpen}
          className="currency-picker__toggle"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {isOpen && (
        <div className="currency-picker__menu" id={listboxId} role="listbox" aria-label="Popular currencies">
          <div className="currency-picker__menu-heading"><Search size={14} />Popular currencies <span>or type any code</span></div>
          <div className="currency-picker__options">
            {filteredCurrencies.length > 0 ? filteredCurrencies.map(([code, name]) => (
              <button
                aria-label={`${code} ${name}`}
                aria-selected={code === normalizedValue}
                className="currency-picker__option"
                key={code}
                role="option"
                type="button"
                onClick={() => selectCurrency(code)}
              >
                <strong>{code}</strong><span>{name}</span>{code === normalizedValue && <Check size={15} />}
              </button>
            )) : <p className="currency-picker__empty">Use a three-letter ISO currency code.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
