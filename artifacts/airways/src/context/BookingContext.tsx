import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface Airport {
  city: string
  code: string
  country: string
  region?: string
  viaHub?: string
}

interface SearchState {
  origin: Airport | null
  destination: Airport | null
  date: string
  returnDate: string
  tripType: 'aller-retour' | 'aller-simple'
  passengers: number
  cabin: string
}

interface Seat {
  id: string
  row: number
  col: string
  occupied: boolean
  extraLegroom: boolean
  price: number
}

interface Flight {
  id: string
  flightNumber: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  nextDay: boolean
  duration: string
  durationMins: number
  stops: string
  aircraft: string
  aircraftCode: string
  cabinsAvailable: string[]
  prices: Record<string, number>
  cabin: string
}

interface BookingContextValue {
  search: SearchState
  setSearch: (s: SearchState) => void
  selectedFlight: Flight | null
  setSelectedFlight: (f: Flight | null) => void
  selectedReturnFlight: Flight | null
  setSelectedReturnFlight: (f: Flight | null) => void
  selectedSeats: Record<string, Seat[]>
  setSelectedSeats: (s: Record<string, Seat[]>) => void
  passengerNames: string[]
  setPassengerNames: (n: string[]) => void
  bookingReference: string | null
  setBookingReference: (r: string | null) => void
  resetBooking: () => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

const emptySearch: SearchState = {
  origin: null,
  destination: null,
  date: '',
  returnDate: '',
  tripType: 'aller-retour',
  passengers: 1,
  cabin: 'Economy',
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<SearchState>(emptySearch)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
  const [selectedReturnFlight, setSelectedReturnFlight] = useState<Flight | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<Record<string, Seat[]>>({})
  const [passengerNames, setPassengerNames] = useState<string[]>([])
  const [bookingReference, setBookingReference] = useState<string | null>(null)

  const resetBooking = () => {
    setSelectedFlight(null)
    setSelectedReturnFlight(null)
    setSelectedSeats({})
    setPassengerNames([])
    setBookingReference(null)
  }

  const value = useMemo(
    () => ({
      search,
      setSearch,
      selectedFlight,
      setSelectedFlight,
      selectedReturnFlight,
      setSelectedReturnFlight,
      selectedSeats,
      setSelectedSeats,
      passengerNames,
      setPassengerNames,
      bookingReference,
      setBookingReference,
      resetBooking,
    }),
    [search, selectedFlight, selectedReturnFlight, selectedSeats, passengerNames, bookingReference],
  )

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export function useBooking() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBooking must be used within BookingProvider')
  return ctx
}
