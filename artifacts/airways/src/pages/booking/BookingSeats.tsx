import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookingLayout from '../../components/BookingLayout'
import { useBooking } from '../../context/BookingContext'
import { generateSeatMap } from '../../data/seatmap'

export default function BookingSeats() {
  const navigate = useNavigate()
  const {
    search,
    selectedFlight,
    selectedReturnFlight,
    setSelectedSeats,
    passengerNames,
    setPassengerNames,
    setBookingReference,
  } = useBooking()

  useEffect(() => {
    if (!selectedFlight) navigate('/reservation', { replace: true })
  }, [selectedFlight, navigate])

  const legs = useMemo(() => {
    const l = [{ key: 'aller', label: 'Vol aller', flight: selectedFlight }]
    if (selectedReturnFlight) l.push({ key: 'retour', label: 'Vol retour', flight: selectedReturnFlight })
    return l.filter((l) => l.flight) as { key: string; label: string; flight: NonNullable<typeof selectedFlight> }[]
  }, [selectedFlight, selectedReturnFlight])

  const [activeLeg, setActiveLeg] = useState('aller')
  const [seatsByLeg, setSeatsByLeg] = useState<Record<string, any[]>>({})
  const [names, setNames] = useState<string[]>(
    passengerNames.length ? passengerNames : Array(search.passengers || 1).fill('')
  )

  if (!selectedFlight) return null

  const currentLeg = legs.find((l) => l.key === activeLeg) || legs[0]
  const seatMap = generateSeatMap(currentLeg.flight.cabin, currentLeg.flight.id)
  const selectedForLeg = seatsByLeg[currentLeg.key] || []

  const toggleSeat = (seat: any) => {
    if (seat.occupied) return
    setSeatsByLeg((prev) => {
      const current = prev[currentLeg.key] || []
      const already = current.find((s) => s.id === seat.id)
      let next
      if (already) {
        next = current.filter((s) => s.id !== seat.id)
      } else if (current.length < (search.passengers || 1)) {
        next = [...current, seat]
      } else {
        next = current
      }
      return { ...prev, [currentLeg.key]: next }
    })
  }

  const allLegsComplete = legs.every((l) => (seatsByLeg[l.key] || []).length === (search.passengers || 1))
  const allNamesFilled = names.every((n) => n.trim().length > 1)

  const fareTotal = legs.reduce((sum, l) => sum + l.flight.prices[l.flight.cabin] * (search.passengers || 1), 0)
  const seatTotal = legs.reduce(
    (sum, l) => sum + (seatsByLeg[l.key] || []).reduce((s: number, seat: any) => s + seat.price, 0),
    0
  )

  const handleContinue = () => {
    setSelectedSeats(seatsByLeg)
    setPassengerNames(names)
    const ref = generateReference()
    setBookingReference(ref)
    navigate('/reservation/confirmation')
  }

  return (
    <BookingLayout
      step={2}
      title="Choisissez vos sièges"
      lede={`Cabine ${currentLeg.flight.cabin} · ${search.passengers} passager${search.passengers > 1 ? 's' : ''} à placer par vol.`}
    >
      {legs.length > 1 && (
        <div className="cabin-toggle">
          {legs.map((l) => (
            <button key={l.key} type="button" className={l.key === activeLeg ? 'active' : ''} onClick={() => setActiveLeg(l.key)}>
              {l.label} · {l.flight.flightNumber}
            </button>
          ))}
        </div>
      )}

      <div className="seatmap-wrap">
        <div className="seatmap">
          <p style={{ marginBottom: 20, fontSize: 13.5, color: 'var(--navy-light)' }}>
            {currentLeg.label} — {currentLeg.flight.flightNumber} · {currentLeg.flight.aircraft}
          </p>
          <div className="seatmap__fuselage">
            {seatMap.rows.map((row) => (
              <div className="seatmap__row" key={row.rowNumber}>
                <span className="seatmap__rownum">{row.rowNumber}</span>
                {row.seats.map((seat) => {
                  const isSelected = (seatsByLeg[currentLeg.key] || []).some((s) => s.id === seat.id)
                  const showAisle = seatMap.aisleAfter.includes(seat.col)
                  return (
                    <span key={seat.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className={`seat ${seat.occupied ? 'seat--occupied' : isSelected ? 'seat--selected' : 'seat--available'} ${seat.extraLegroom ? 'seat--extra' : ''}`}
                        onClick={() => toggleSeat(seat)}
                        disabled={seat.occupied}
                        aria-label={`Siège ${seat.id}${seat.occupied ? ', occupé' : isSelected ? ', sélectionné' : ', disponible'}`}
                      >
                        {seat.col}
                      </button>
                      {showAisle && <span className="seatmap__aisle" />}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="seatmap-summary">
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>{currentLeg.label}</h3>
          <p className="mono-tag" style={{ color: 'var(--navy-light)' }}>{selectedForLeg.length} / {search.passengers || 1} sièges choisis</p>

          <div className="seatmap-legend">
            <span className="seatmap-legend__item"><span className="seat seat--available" style={{ width: 18, height: 18 }} /> Disponible</span>
            <span className="seatmap-legend__item"><span className="seat seat--selected" style={{ width: 18, height: 18 }} /> Votre sélection</span>
            <span className="seatmap-legend__item"><span className="seat seat--occupied" style={{ width: 18, height: 18 }} /> Occupé</span>
            <span className="seatmap-legend__item"><span className="seat seat--extra" style={{ width: 18, height: 18 }} /> Espace additionnel</span>
          </div>

          <hr className="hairline" style={{ margin: '20px 0' }} />

          <div className="passenger-form">
            <span className="eyebrow">Passagers</span>
            {names.map((n, i) => (
              <div className="booking-form__field" key={i}>
                <label htmlFor={`pax-${i}`}>Passager {i + 1}</label>
                <input
                  id={`pax-${i}`}
                  value={n}
                  placeholder="Nom et prénom"
                  onChange={(e) => {
                    const copy = [...names]
                    copy[i] = e.target.value
                    setNames(copy)
                  }}
                />
              </div>
            ))}
          </div>

          <hr className="hairline" style={{ margin: '20px 0' }} />

          <div className="confirmation-details__row" style={{ marginBottom: 8 }}>
            <span>Tarif billets</span>
            <span>{fareTotal} €</span>
          </div>
          <div className="confirmation-details__row" style={{ marginBottom: 16 }}>
            <span>Sièges</span>
            <span>{seatTotal ? `+${seatTotal} €` : 'Inclus'}</span>
          </div>

          <button
            type="button"
            className="btn btn--gold btn--block"
            disabled={!allLegsComplete || !allNamesFilled}
            onClick={handleContinue}
          >
            Continuer vers le paiement
          </button>
          {(!allLegsComplete || !allNamesFilled) && (
            <p style={{ fontSize: 12.5, color: 'var(--navy-light)', marginTop: 10 }}>
              Sélectionnez un siège par passager sur chaque vol et renseignez chaque nom pour continuer.
            </p>
          )}
        </div>
      </div>
    </BookingLayout>
  )
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = ''
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)]
  return ref
}
