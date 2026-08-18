import { FLEET } from './fleet'

function seedFromString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function minutesToClock(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${pad(h)}h${pad(m)}`
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h${pad(m)}` : `${h}h00`
}

const REGION_DURATION: Record<string, [number, number]> = {
  Europe: [90, 210],
  'Amérique du Nord': [520, 620],
  'Amérique latine & Caraïbes': [560, 660],
  Asie: [640, 760],
  Afrique: [180, 380],
  'Moyen-Orient': [340, 420],
  Océanie: [980, 1080],
}

function aircraftForDuration(mins: number) {
  if (mins >= 480) {
    return FLEET.find((f) => f.code === 'A350-900')
  }
  if (mins >= 300) {
    return FLEET.find((f) => f.code === 'A321XLR')
  }
  const shortHaul = FLEET.filter((f) => f.range === 'Moyen-courrier')
  return shortHaul[0]
}

interface GenerateFlightsParams {
  origin: string
  destination: string
  date: string
  region: string
}

export function generateFlights({ origin, destination, date, region }: GenerateFlightsParams) {
  const seedStr = `${origin}-${destination}-${date}`
  const rand = seededRandom(seedFromString(seedStr))
  const [minDur, maxDur] = REGION_DURATION[region] || [150, 300]

  const count = 3 + Math.floor(rand() * 2)
  const flights = []

  for (let i = 0; i < count; i++) {
    const durationMins = Math.round(minDur + rand() * (maxDur - minDur))
    const departMinutes = Math.round(360 + rand() * 780)
    const arriveMinutes = departMinutes + durationMins
    const aircraft = aircraftForDuration(durationMins)
    const basePrice = 60 + durationMins * (0.55 + rand() * 0.25)

    flights.push({
      id: `${seedStr}-${i}`,
      flightNumber: `CW ${800 + Math.floor(rand() * 900)}`,
      origin,
      destination,
      departTime: minutesToClock(departMinutes),
      arriveTime: minutesToClock(arriveMinutes % (24 * 60)),
      nextDay: arriveMinutes >= 24 * 60,
      duration: durationLabel(durationMins),
      durationMins,
      stops: 'Direct',
      aircraft: aircraft?.name || 'Airbus A320neo',
      aircraftCode: aircraft?.code || 'A320neo',
      cabinsAvailable: aircraft?.cabins || ['Economy', 'Business'],
      prices: {
        Economy: Math.round(basePrice),
        'Premium Economy': Math.round(basePrice * 1.55),
        Business: Math.round(basePrice * 2.9),
        Première: Math.round(basePrice * 5.4),
      },
    })
  }

  return flights.sort((a, b) => a.departTime.localeCompare(b.departTime))
}
