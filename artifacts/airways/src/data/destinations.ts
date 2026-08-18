export const HUB = { city: 'Caledora', code: 'CLR', country: 'République de Caledora' }

export const REGIONS = [
  {
    id: 'europe',
    label: 'Europe',
    blurb: "L'Europe concentre la majorité des fréquences du réseau, alimentant le hub plusieurs fois par jour.",
    destinations: [
      { city: 'Paris', code: 'CDG', country: 'France' },
      { city: 'Madrid', code: 'MAD', country: 'Espagne' },
      { city: 'Barcelone', code: 'BCN', country: 'Espagne' },
      { city: 'Rome', code: 'FCO', country: 'Italie' },
      { city: 'Milan', code: 'MXP', country: 'Italie' },
      { city: 'Lisbonne', code: 'LIS', country: 'Portugal' },
      { city: 'Amsterdam', code: 'AMS', country: 'Pays-Bas' },
      { city: 'Francfort', code: 'FRA', country: 'Allemagne' },
      { city: 'Munich', code: 'MUC', country: 'Allemagne' },
      { city: 'Bruxelles', code: 'BRU', country: 'Belgique' },
      { city: 'Zurich', code: 'ZRH', country: 'Suisse' },
      { city: 'Vienne', code: 'VIE', country: 'Autriche' },
      { city: 'Londres', code: 'LHR', country: 'Royaume-Uni' },
      { city: 'Manchester', code: 'MAN', country: 'Royaume-Uni' },
    ],
  },
  {
    id: 'amerique-nord',
    label: 'Amérique du Nord',
    blurb: "New York constitue la principale destination long-courrier de la compagnie.",
    destinations: [
      { city: 'New York', code: 'JFK', country: 'États-Unis' },
      { city: 'Boston', code: 'BOS', country: 'États-Unis' },
      { city: 'Miami', code: 'MIA', country: 'États-Unis' },
      { city: 'Washington', code: 'IAD', country: 'États-Unis' },
      { city: 'Los Angeles', code: 'LAX', country: 'États-Unis' },
      { city: 'San Francisco', code: 'SFO', country: 'États-Unis' },
      { city: 'Montréal', code: 'YUL', country: 'Canada' },
      { city: 'Toronto', code: 'YYZ', country: 'Canada' },
    ],
  },
  {
    id: 'amerique-latine',
    label: 'Amérique latine & Caraïbes',
    blurb: "Un réseau plus réduit que l'Europe ou l'Amérique du Nord, mais un axe de développement prioritaire.",
    destinations: [
      { city: 'São Paulo', code: 'GRU', country: 'Brésil' },
      { city: 'Mexico', code: 'MEX', country: 'Mexique' },
      { city: 'Buenos Aires', code: 'EZE', country: 'Argentine' },
      { city: 'Bogotá', code: 'BOG', country: 'Colombie' },
      { city: 'La Havane', code: 'HAV', country: 'Cuba' },
      { city: 'San Juan', code: 'SJU', country: 'Porto Rico' },
    ],
  },
  {
    id: 'asie',
    label: 'Asie',
    blurb: "Tokyo et Séoul figurent parmi les principales destinations, Singapour jouant un rôle de correspondance vers l'Asie du Sud-Est et l'Océanie.",
    destinations: [
      { city: 'Tokyo', code: 'HND', country: 'Japon' },
      { city: 'Séoul', code: 'ICN', country: 'Corée du Sud' },
      { city: 'Singapour', code: 'SIN', country: 'Singapour' },
      { city: 'Bangkok', code: 'BKK', country: 'Thaïlande' },
    ],
  },
  {
    id: 'afrique',
    label: 'Afrique',
    blurb: "Le réseau africain est concentré sur l'Afrique du Nord et quelques grands centres économiques.",
    destinations: [
      { city: 'Alger', code: 'ALG', country: 'Algérie' },
      { city: 'Tunis', code: 'TUN', country: 'Tunisie' },
      { city: 'Casablanca', code: 'CMN', country: 'Maroc' },
      { city: 'Marrakech', code: 'RAK', country: 'Maroc' },
      { city: 'Le Caire', code: 'CAI', country: 'Égypte' },
      { city: 'Dakar', code: 'DSS', country: 'Sénégal' },
      { city: 'Lagos', code: 'LOS', country: 'Nigéria' },
    ],
  },
  {
    id: 'moyen-orient',
    label: 'Moyen-Orient',
    blurb: "Dubaï, Beyrouth et Riyad sont desservies directement, ainsi que Tel Aviv selon les conditions opérationnelles.",
    destinations: [
      { city: 'Dubaï', code: 'DXB', country: 'Émirats arabes unis' },
      { city: 'Beyrouth', code: 'BEY', country: 'Liban' },
      { city: 'Riyad', code: 'RUH', country: 'Arabie saoudite' },
      { city: 'Tel Aviv', code: 'TLV', country: 'Israël' },
    ],
  },
  {
    id: 'oceanie',
    label: 'Océanie',
    blurb: "Sydney est commercialisée via Singapour, même numéro de vol sur les deux segments.",
    destinations: [
      { city: 'Sydney', code: 'SYD', country: 'Australie', viaHub: 'SIN' },
    ],
  },
]

export const ALL_DESTINATIONS = REGIONS.flatMap((r) =>
  r.destinations.map((d) => ({ ...d, region: r.label }))
)

export function regionFor(
  origin: { code: string } | null,
  destination: { code: string } | null,
): string {
  const nonHub = origin?.code === HUB.code ? destination : origin
  const match = ALL_DESTINATIONS.find((d) => d.code === nonHub?.code)
  return match?.region || 'Europe'
}

export const NETWORK_STATS = [
  { label: 'Destinations', value: '135', suffix: 'selon les saisons' },
  { label: 'Passagers annuels', value: '18M', suffix: 'voyageurs' },
  { label: 'En correspondance', value: '20%', suffix: 'du trafic total' },
  { label: 'Vagues quotidiennes', value: '4', suffix: 'au hub de Caledora' },
]
