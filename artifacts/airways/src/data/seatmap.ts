interface SeatLayout {
  columns: string[]
  aisleAfter: string[]
  rows: number
  price: number
}

const LAYOUTS: Record<string, SeatLayout> = {
  Economy: { columns: ['A', 'B', 'C', 'D', 'E', 'F'], aisleAfter: ['C'], rows: 18, price: 0 },
  'Premium Economy': { columns: ['A', 'B', 'C', 'D', 'E', 'F'], aisleAfter: ['C'], rows: 6, price: 24 },
  Business: { columns: ['A', 'C', 'D', 'F'], aisleAfter: ['C'], rows: 8, price: 65 },
  Première: { columns: ['A', 'D'], aisleAfter: ['A'], rows: 4, price: 140 },
}

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

export function generateSeatMap(cabin: string, seedStr: string) {
  const layout = LAYOUTS[cabin] || LAYOUTS.Economy
  const rand = seededRandom(seedFromString(seedStr + cabin))
  const rowStart = cabin === 'Economy' ? 12 : cabin === 'Premium Economy' ? 8 : cabin === 'Business' ? 3 : 1
  const rows = []

  for (let r = 0; r < layout.rows; r++) {
    const rowNumber = rowStart + r
    const seats = layout.columns.map((col) => {
      const occupied = rand() < 0.32
      const isExtraLegroom = cabin === 'Economy' && r === 0
      const priceSurcharge = layout.price + (isExtraLegroom ? 12 : 0)
      return {
        id: `${rowNumber}${col}`,
        row: rowNumber,
        col,
        occupied,
        extraLegroom: isExtraLegroom,
        price: priceSurcharge,
      }
    })
    rows.push({ rowNumber, seats })
  }

  return { ...layout, rows }
}
