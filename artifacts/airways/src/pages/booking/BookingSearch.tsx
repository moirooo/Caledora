import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookingLayout from '../../components/BookingLayout'
import { useBooking } from '../../context/BookingContext'
import { HUB, ALL_DESTINATIONS } from '../../data/destinations'

const CABIN_OPTIONS = ['Economy', 'Premium Economy', 'Business', 'Première']

export default function BookingSearch() {
  const navigate = useNavigate()
  const { search, setSearch } = useBooking()

  const today = new Date().toISOString().slice(0, 10)

  const [tripType, setTripType] = useState(search.tripType || 'aller-retour')
  const [origin, setOrigin] = useState(search.origin?.code || HUB.code)
  const [destination, setDestination] = useState(search.destination?.code || 'JFK')
  const [date, setDate] = useState(search.date || today)
  const [returnDate, setReturnDate] = useState(search.returnDate || '')
  const [passengers, setPassengers] = useState(search.passengers || 1)
  const [cabin, setCabin] = useState(search.cabin || 'Economy')
  const [error, setError] = useState('')

  const airportOptions = [HUB, ...ALL_DESTINATIONS]

  const findAirport = (code: string) => airportOptions.find((a) => a.code === code) ?? null

  const handleSwap = () => {
    setOrigin(destination)
    setDestination(origin)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (origin === destination) {
      setError('Origine et destination doivent être différentes.')
      return
    }
    if (tripType === 'aller-retour' && (!returnDate || returnDate < date)) {
      setError('Merci de choisir une date de retour valide.')
      return
    }
    setError('')
    setSearch({
      origin: findAirport(origin),
      destination: findAirport(destination),
      date,
      returnDate: tripType === 'aller-retour' ? returnDate : '',
      tripType: tripType as 'aller-retour' | 'aller-simple',
      passengers: Number(passengers),
      cabin,
    })
    navigate('/reservation/resultats')
  }

  return (
    <BookingLayout
      step={0}
      title="Rechercher un vol"
      lede="Une simulation de réservation — aucun paiement réel n'est effectué."
    >
      <form className="booking-form" onSubmit={handleSubmit}>
        <div className="booking-form__triptype">
          <button
            type="button"
            className={`triptype-btn ${tripType === 'aller-retour' ? 'triptype-btn--active' : ''}`}
            onClick={() => setTripType('aller-retour')}
          >
            Aller-retour
          </button>
          <button
            type="button"
            className={`triptype-btn ${tripType === 'aller-simple' ? 'triptype-btn--active' : ''}`}
            onClick={() => setTripType('aller-simple')}
          >
            Aller simple
          </button>
        </div>

        <div className="booking-form__row booking-form__route-row">
          <div className="booking-form__field">
            <label htmlFor="origin">Origine</label>
            <select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value={HUB.code}>{HUB.city} ({HUB.code})</option>
              <optgroup label="Réseau">
                {ALL_DESTINATIONS.map((d) => (
                  <option key={d.code} value={d.code}>{d.city} ({d.code})</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="booking-form__swap">
            <button type="button" className="search-swap" onClick={handleSwap} aria-label="Inverser origine et destination">
              ⇄
            </button>
          </div>
          <div className="booking-form__field">
            <label htmlFor="destination">Destination</label>
            <select id="destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value={HUB.code}>{HUB.city} ({HUB.code})</option>
              <optgroup label="Réseau">
                {ALL_DESTINATIONS.map((d) => (
                  <option key={d.code} value={d.code}>{d.city} ({d.code})</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="booking-form__row">
          <div className="booking-form__field">
            <label htmlFor="date">Date de départ</label>
            <input id="date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="booking-form__field">
            <label htmlFor="returnDate">Date de retour</label>
            <input
              id="returnDate"
              type="date"
              min={date}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={tripType === 'aller-simple'}
              required={tripType === 'aller-retour'}
            />
          </div>
        </div>

        <div className="booking-form__row">
          <div className="booking-form__field">
            <label htmlFor="passengers">Passagers</label>
            <select id="passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} passager{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div className="booking-form__field">
            <label htmlFor="cabin">Cabine</label>
            <select id="cabin" value={cabin} onChange={(e) => setCabin(e.target.value)}>
              {CABIN_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p style={{ color: '#B3432B', fontSize: 13.5, marginBottom: 16 }}>{error}</p>}

        <button type="submit" className="btn btn--gold btn--block">Rechercher des vols</button>
      </form>
    </BookingLayout>
  )
}
