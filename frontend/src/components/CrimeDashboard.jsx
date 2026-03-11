// components/CrimeDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const CRIME_METRICS = [
  { key: 'violent_rate',      label: 'Violent Crime Rate',    format: 'decimal', unit: 'per 100k', higherIsBetter: false },
  { key: 'property_rate',     label: 'Property Crime Rate',   format: 'decimal', unit: 'per 100k', higherIsBetter: false },
  { key: 'drug_rate',         label: 'Drug Offense Rate',     format: 'decimal', unit: 'per 100k', higherIsBetter: false },
  { key: 'weapon_rate',       label: 'Weapon Violation Rate', format: 'decimal', unit: 'per 100k', higherIsBetter: false },
  { key: 'total_crimes_rate', label: 'Total Crime Rate',      format: 'decimal', unit: 'per 100k', higherIsBetter: false },
  { key: 'violent',           label: 'Violent Crimes',        format: 'number',  unit: 'count',    higherIsBetter: false },
  { key: 'property',          label: 'Property Crimes',       format: 'number',  unit: 'count',    higherIsBetter: false },
]

const INDICATOR_COLORS = {
  violent_rate:      '#c04040',
  property_rate:     '#d4750a',
  drug_rate:         '#8b2080',
  weapon_rate:       '#404080',
  total_crimes_rate: '#805030',
  violent:           '#c04040',
  property:          '#d4750a',
}

const SCALES = {
  violent_rate:      d3.schemeReds[7],
  property_rate:     d3.schemeOranges[7],
  drug_rate:         d3.schemePurples[7],
  weapon_rate:       d3.schemeBlues[7],
  total_crimes_rate: d3.schemeReds[7],
  violent:           d3.schemeReds[7],
  property:          d3.schemeOranges[7],
}

function fmtCrime(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'decimal') return n.toFixed(1)
  if (format === 'number') return n.toLocaleString()
  return n.toFixed(1)
}

// ── Map ────────────────────────────────────────────────────────────────────────
function CrimeMap({ counties, indicator, selectedFips, onCountyClick }) {
  const svgRef = useRef(null)
  const [geo, setGeo] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const dataMap = useRef({})

  useEffect(() => {
    d3.json(TOPO_URL).then(topo => {
      const all = topojson.feature(topo, topo.objects.counties)
      all.features = all.features.filter(f => f.id.startsWith(INDIANA_STATE_FIPS))
      setGeo(all)
    })
  }, [])

  useEffect(() => {
    dataMap.current = {}
    counties.forEach(c => { dataMap.current[c.fips] = c })
  }, [counties])

  useEffect(() => {
    if (!geo || !counties.length || !svgRef.current) return
    const svg    = d3.select(svgRef.current)
    const width  = svgRef.current.clientWidth  || 600
    const height = svgRef.current.clientHeight || 560
    svg.attr('viewBox', `0 0 ${width} ${height}`)
    const projection = d3.geoAlbersUsa().fitSize([width - 20, height - 20], geo)
    const path = d3.geoPath().projection(projection)
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    const scheme = SCALES[indicator] || d3.schemeReds[7]
    const colorScale = d3.scaleQuantile().domain(values).range(scheme)
    const paths = svg.selectAll('path.county-path').data(geo.features, d => d.id)
    paths.enter().append('path').attr('class', 'county-path').merge(paths)
      .attr('d', path)
      .attr('fill', d => {
        const county = dataMap.current[d.id]
        const val = county?.[indicator]
        if (val == null) return '#1a2535'  // no data = darker
        return colorScale(Number(val))
      })
      .classed('selected', d => d.id === selectedFips)
      .on('mouseenter', function(event, d) {
        const county = dataMap.current[d.id]
        if (!county) return
        setTooltip({ x: event.clientX, y: event.clientY, county })
      })
      .on('mousemove', function(event) {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', function() { setTooltip(null) })
      .on('click', function(event, d) {
        const county = dataMap.current[d.id]
        if (county) onCountyClick?.(county)
      })
    paths.exit().remove()
  }, [geo, counties, indicator, selectedFips])

  const legendData = (() => {
    if (!counties.length) return null
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!values.length) return null
    const [mn, mx] = d3.extent(values)
    return { min: mn, max: mx }
  })()

  const meta = CRIME_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 280), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc" style={{ marginBottom: 8 }}>
            {tooltip.county.violent_rate != null ? 'NIBRS 2024 · Reporting' : 'No NIBRS data reported'}
          </div>
          <div className="tooltip-row"><span className="tooltip-label">Violent Crime Rate</span><span className="tooltip-value">{fmtCrime(tooltip.county.violent_rate, 'decimal')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Property Crime Rate</span><span className="tooltip-value">{fmtCrime(tooltip.county.property_rate, 'decimal')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Drug Offense Rate</span><span className="tooltip-value">{fmtCrime(tooltip.county.drug_rate, 'decimal')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Total Crime Rate</span><span className="tooltip-value">{fmtCrime(tooltip.county.total_crimes_rate, 'decimal')}</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label} ({meta.unit})</div>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${(SCALES[indicator] || d3.schemeReds[7]).join(', ')})` }} />
          <div className="legend-labels">
            <span>{legendData.min.toFixed(0)}</span>
            <span>{((legendData.min + legendData.max) / 2).toFixed(0)}</span>
            <span>{legendData.max.toFixed(0)}</span>
          </div>
          <div style={{ fontSize: '0.55rem', color: 'var(--cream-faint)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            Dark counties = no NIBRS data
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function CrimeLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    CRIME_METRICS.forEach(m => {
      const vals = counties.map(c => c[m.key]).filter(v => v != null).map(Number)
      if (vals.length) {
        const sorted = [...vals].sort((a, b) => a - b)
        s[m.key] = {
          min: Math.min(...vals),
          max: Math.max(...vals),
          median: sorted[Math.floor(sorted.length / 2)],
          mean: vals.reduce((a, b) => a + b, 0) / vals.length,
          count: vals.length,
        }
      }
    })
    return s
  }, [counties])

  const activeMeta = CRIME_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Crime Indicator</div>
        <div className="indicator-list">
          {CRIME_METRICS.map(m => (
            <button
              key={m.key}
              className={`indicator-btn ${activeIndicator === m.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(m.key)}
            >
              <div className="indicator-btn-swatch" style={{ background: INDICATOR_COLORS[m.key] || '#607080' }} />
              <div>
                <div>{m.label}</div>
                <div className="indicator-btn-meta">{m.unit} · NIBRS 2024</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeMeta && activeStat && (
        <div className="panel-section">
          <div className="panel-section-title">Indiana — {activeMeta.label}</div>
          <div className="stat-grid">
            <div className="stat-box"><div className="stat-box-value">{activeStat.median.toFixed(1)}</div><div className="stat-box-label">Median county</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.mean.toFixed(1)}</div><div className="stat-box-label">County avg</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.min.toFixed(1)}</div><div className="stat-box-label">Lowest county</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.max.toFixed(1)}</div><div className="stat-box-label">Highest county</div></div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title" style={{ color: 'var(--amber)', opacity: 0.8 }}>⚠ Coverage Note</div>
        <p style={{ fontSize: '0.72rem', color: 'var(--cream-faint)', lineHeight: 1.6 }}>
          {counties.length} of 92 counties report to NIBRS. Counties shown in dark gray have no reporting agencies in 2024. This does not mean zero crime — it means no data was submitted.
        </p>
      </div>

      <div className="panel-section">
        <div className="panel-section-title">Data Source</div>
        <div className="source-list">
          <div className="source-item">
            <div className="source-name">FBI NIBRS 2024</div>
            <div className="source-desc">National Incident-Based Reporting System, Indiana bulk download</div>
          </div>
          <div className="source-item">
            <div className="source-name">CENSUS ACS 2022</div>
            <div className="source-desc">Population denominators for per-100k rates</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function CrimeRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    CRIME_METRICS.forEach(m => {
      const vals = counties.map(c => c[m.key]).filter(v => v != null).map(Number)
      if (vals.length) s[m.key] = { min: Math.min(...vals), max: Math.max(...vals) }
    })
    return s
  }, [counties])

  const handleSort = key => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sortedCounties = useMemo(() => [...counties].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return sortAsc ? av - bv : bv - av
  }), [counties, sortKey, sortAsc])

  const downloadCsv = () => {
    const headers = ['fips', 'county_name', ...CRIME_METRICS.map(m => m.key), 'total_population']
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_crime_data.csv'
    a.click()
  }

  return (
    <aside className="panel-right">
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'detail' ? 'active' : ''}`} onClick={() => setTab('detail')}>County Detail</button>
        <button className={`tab-btn ${tab === 'rankings' ? 'active' : ''}`} onClick={() => setTab('rankings')}>Rankings</button>
      </div>

      {tab === 'detail' && (
        county ? (
          <div className="county-detail">
            <div className="county-detail-header">
              <div className="county-detail-name">{county.county_name}<span> County</span></div>
              <div className="county-detail-sub">
                <span className="county-detail-tag">FIPS {county.fips}</span>
                <span className="county-detail-tag" style={{ color: county.violent_rate != null ? '#3a9e6a' : '#c06060' }}>
                  {county.violent_rate != null ? 'NIBRS Reporting' : 'No Data'}
                </span>
              </div>
            </div>
            {county.violent_rate == null ? (
              <div style={{ padding: '24px 20px', color: 'var(--cream-faint)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                This county does not have agencies reporting to NIBRS in 2024. Crime may still occur — this is a data coverage gap, not zero crime.
              </div>
            ) : (
              <div className="county-metrics">
                {CRIME_METRICS.map(m => {
                  const val = county[m.key]
                  const s = stats[m.key]
                  const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
                  const rank = getRank(counties, county.fips, m.key, false)
                  return (
                    <div key={m.key} className={`metric-row ${m.key === activeIndicator ? 'highlight' : ''}`}>
                      <div className="metric-row-info">
                        <div className="metric-row-label">{m.label}</div>
                        <div className="metric-row-source">NIBRS 2024 · {m.unit}</div>
                        {s && val != null && <div className="metric-row-bar-wrap"><div className="metric-row-bar" style={{ width: `${barW}%` }} /></div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="metric-row-value">{fmtCrime(val, m.format)}</div>
                        {rank != null && <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--cream-faint)', marginTop: 2 }}>#{rank} of {counties.filter(c => c[m.key] != null).length}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="county-panel-empty">
            <div className="county-panel-empty-icon">⬡</div>
            <div className="county-panel-empty-text">Hover over a county<br />to preview data.<br /><br />Click to pin<br />full details here.</div>
          </div>
        )
      )}

      {tab === 'rankings' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="rankings-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th onClick={() => handleSort('county_name')}>County {sortKey === 'county_name' ? (sortAsc ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort(activeIndicator)}>
                    {CRIME_METRICS.find(m => m.key === activeIndicator)?.label} {sortKey === activeIndicator ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('violent_rate')}>Violent Rate {sortKey === 'violent_rate' ? (sortAsc ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => {
                  const meta = CRIME_METRICS.find(m => m.key === activeIndicator)
                  return (
                    <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                      <td className="rank">{i + 1}</td>
                      <td>{c.county_name}</td>
                      <td className="mono">{fmtCrime(c[activeIndicator], meta?.format)}</td>
                      <td className="mono" style={{ color: 'var(--cream-faint)' }}>{fmtCrime(c.violent_rate, 'decimal')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button className="download-btn" onClick={downloadCsv}>↓ Download CSV — {counties.length} reporting counties</button>
        </div>
      )}
    </aside>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CrimeDashboard() {
  const [counties, setCounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('violent_rate')
  const [selectedCounty, setSelectedCounty] = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/crime_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = CRIME_METRICS.find(m => m.key === activeIndicator)

  return (
    <div className="layout">
      {!loading && !error && (
        <CrimeLeftPanel
          counties={counties}
          activeIndicator={activeIndicator}
          onIndicatorChange={setActiveIndicator}
        />
      )}
      <main className="map-area">
        <div className="map-toolbar">
          <div>
            <div className="map-toolbar-title">{activeMeta?.label || 'Indiana Crime Map'}</div>
            <div className="map-toolbar-subtitle">
              {selectedCounty
                ? `${selectedCounty.county_name} County selected — click again to deselect`
                : 'Hover to preview · click to pin county details · dark = no NIBRS data'}
            </div>
          </div>
        </div>
        <div className="map-container">
          {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading crime data...</div></div>}
          {error && <div className="map-loading"><div style={{ color: 'var(--red-accent)', fontSize: '0.8rem', textAlign: 'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
          {!loading && !error && (
            <CrimeMap
              counties={counties}
              indicator={activeIndicator}
              selectedFips={selectedCounty?.fips}
              onCountyClick={handleCountyClick}
            />
          )}
        </div>
      </main>
      {!loading && !error && (
        <CrimeRightPanel
          county={selectedCounty}
          counties={counties}
          activeIndicator={activeIndicator}
        />
      )}
    </div>
  )
}
