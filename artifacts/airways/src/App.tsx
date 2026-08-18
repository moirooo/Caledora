import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Destinations from './pages/Destinations'
import Fleet from './pages/Fleet'
import Cabins from './pages/Cabins'
import Aurora from './pages/Aurora'
import About from './pages/About'
import NotFound from './pages/NotFound'
import BookingSearch from './pages/booking/BookingSearch'
import BookingResults from './pages/booking/BookingResults'
import BookingSeats from './pages/booking/BookingSeats'
import BookingConfirmation from './pages/booking/BookingConfirmation'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/flotte" element={<Fleet />} />
          <Route path="/cabines" element={<Cabins />} />
          <Route path="/aurora" element={<Aurora />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="/reservation" element={<BookingSearch />} />
          <Route path="/reservation/resultats" element={<BookingResults />} />
          <Route path="/reservation/sieges" element={<BookingSeats />} />
          <Route path="/reservation/confirmation" element={<BookingConfirmation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
