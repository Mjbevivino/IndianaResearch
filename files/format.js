// utils/format.js

export function formatValue(value, format) {
  if (value == null || value === '') return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return String(value)

  switch (format) {
    case 'currency':
      return n >= 1000
        ? '$' + (n >= 1_000_000
            ? (n / 1_000_000).toFixed(1) + 'M'
            : n.toLocaleString('en-US', { maximumFractionDigits: 0 }))
        : '$' + n.toFixed(0)
    case 'percent':
      return n.toFixed(1) + '%'
    case 'number':
      return n >= 1_000_000
        ? (n / 1_000_000).toFixed(2) + 'M'
        : n >= 1_000
        ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : n.toFixed(0)
    default:
      return String(value)
  }
}

export function getRank(counties, fips, key, ascending = false) {
  const sorted = [...counties]
    .filter(c => c[key] != null)
    .sort((a, b) => ascending ? a[key] - b[key] : b[key] - a[key])
  const idx = sorted.findIndex(c => c.fips === fips)
  return idx === -1 ? null : idx + 1
}

// Normalize a value 0–1 within the dataset range (for bar widths etc)
export function normalize(value, min, max) {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}
