// components/HousingDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const HOUSING_METRICS = [
  { key: 'median_home_value',  label: 'Median Home Value',              format: 'dollars', unit: 'dollars',  higherIsBetter: true  },
  { key: 'median_gross_rent',  label: 'Median Gross Rent',              format: 'dollars', unit: 'dollars',  higherIsBetter: null  },
  { key: 'vacancy_rate',       label: 'Vacancy Rate',                   format: 'pct',     unit: '% of units', higherIsBetter: null },
  { key: 'owner_occ_rate',     label: 'Homeownership Rate',             format: 'pct',     unit: '% of units', higherIsBetter: true },
  { key: 'renter_occ_rate',    label: 'Renter Rate',                    format: 'pct',     unit: '% of units', higherIsBetter: null },
  { key: 'rent_burden_30plus', label: 'Rent Burdened (30%+ of income)', format: 'pct',     unit: '% of renters', higherIsBetter: false },
  { key: 'rent_burden_50plus', label: 'Severely Rent Burdened (50%+)',  format: 'pct',     unit: '% of renters', higherIsBetter: false },
]

const INDICATOR_COLORS = {
  median_home_value:  '#c8a94a',
  median_gross_rent:  '#4a8ec8',
  vacancy_rate:       '#9e4a7a',
  owner_occ_rate:     '#3a9e6a',
  renter_occ_rate:    '#c07030',
  rent_burden_30plus: '#c04060',
  rent_burden_50plus: '#8a1a2a',
}

const SCALES = {
  median_home_value:  d3.schemeYlOrRd[7],
  median_gross_rent:  d3.schemeBlues[7],
  vacancy_rate:       d3.schemePurples[7],
  owner_occ_rate:     d3.schemeGreens[7],
  renter_occ_rate:    d3.schemeOranges[7],
  rent_burden_30plus: d3.schemeReds[7],
  rent_burden_50plus: d3.schemeReds[7],
}

function fmtH(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'dollars') return `$${Math.round(n).toLocaleString()}`
  if (format === 'pct')     return `${n.toFixed(1)}%`
  return n.toLocaleString()
}

// ── Map ────────────────────────────────────────────────────────────────────────
function HousingMap({ counties, indicator, selectedFips, onCountyClick }) {
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
    const scheme = SCALES[indicator] || d3.schemeBlues[7]
    const colorScale = d3.scaleQuantile().domain(values).range(scheme)

    const paths = svg.selectAll('path.county-path').data(geo.features, d => d.id)
    paths.enter().append('path').attr('class', 'county-path').merge(paths)
      .attr('d', path)
      .attr('fill', d => {
        const county = dataMap.current[d.id]
        const val = county?.[indicator]
        if (val == null) return '#1e2a3a'
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

  const legendData = useMemo(() => {
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!values.length) return null
    return { min: Math.min(...values), max: Math.max(...values) }
  }, [counties, indicator])

  const meta = HOUSING_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 290), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc" style={{ marginBottom: 8 }}>ACS 5-Year 2022</div>
          <div className="tooltip-row"><span className="tooltip-label">Median Home Value</span><span className="tooltip-value">{fmtH(tooltip.county.median_home_value,'dollars')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Median Gross Rent</span><span className="tooltip-value">{fmtH(tooltip.county.median_gross_rent,'dollars')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Vacancy Rate</span><span className="tooltip-value">{fmtH(tooltip.county.vacancy_rate,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Rent Burdened 50%+</span><span className="tooltip-value">{fmtH(tooltip.county.rent_burden_50plus,'pct')}</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label} ({meta.unit})</div>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${(SCALES[indicator]||d3.schemeBlues[7]).join(', ')})` }} />
          <div className="legend-labels">
            <span>{meta.format==='dollars' ? `$${Math.round(legendData.min).toLocaleString()}` : `${legendData.min.toFixed(0)}%`}</span>
            <span>{meta.format==='dollars' ? `$${Math.round((legendData.min+legendData.max)/2).toLocaleString()}` : `${((legendData.min+legendData.max)/2).toFixed(0)}%`}</span>
            <span>{meta.format==='dollars' ? `$${Math.round(legendData.max).toLocaleString()}` : `${legendData.max.toFixed(0)}%`}</span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function HousingLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    HOUSING_METRICS.forEach(m => {
      const vals = counties.map(c => c[m.key]).filter(v => v != null).map(Number)
      if (vals.length) {
        const sorted = [...vals].sort((a, b) => a - b)
        s[m.key] = {
          min: Math.min(...vals), max: Math.max(...vals),
          median: sorted[Math.floor(sorted.length / 2)],
          mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        }
      }
    })
    return s
  }, [counties])

  const activeMeta = HOUSING_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  const fmtStat = v => {
    if (v == null) return 'N/A'
    if (activeMeta?.format === 'dollars') return `$${Math.round(v).toLocaleString()}`
    if (activeMeta?.format === 'pct')     return `${v.toFixed(1)}%`
    return Math.round(v).toLocaleString()
  }

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Housing Indicator</div>
        <div className="indicator-list">
          {HOUSING_METRICS.map(m => (
            <button
              key={m.key}
              className={`indicator-btn ${activeIndicator === m.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(m.key)}
            >
              <div className="indicator-btn-swatch" style={{ background: INDICATOR_COLORS[m.key] }} />
              <div>
                <div>{m.label}</div>
                <div className="indicator-btn-meta">ACS 2022 · {m.unit}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeMeta && activeStat && (
        <div className="panel-section">
          <div className="panel-section-title">Indiana — {activeMeta.label}</div>
          <div className="stat-grid">
            <div className="stat-box"><div className="stat-box-value">{fmtStat(activeStat.median)}</div><div className="stat-box-label">Median county</div></div>
            <div className="stat-box"><div className="stat-box-value">{fmtStat(activeStat.mean)}</div><div className="stat-box-label">County avg</div></div>
            <div className="stat-box"><div className="stat-box-value">{fmtStat(activeStat.min)}</div><div className="stat-box-label">Lowest county</div></div>
            <div className="stat-box"><div className="stat-box-value">{fmtStat(activeStat.max)}</div><div className="stat-box-label">Highest county</div></div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">Data Source</div>
        <div className="source-list">
          <div className="source-item">
            <div className="source-name">Census ACS 5-Year 2022</div>
            <div className="source-desc">American Community Survey housing estimates. Vacancy, tenure, rent, home value, and cost burden by county.</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function HousingRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    HOUSING_METRICS.forEach(m => {
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
    const headers = ['fips','county_name',...HOUSING_METRICS.map(m=>m.key)]
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','),...rows].join('\n')], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_housing_data.csv'
    a.click()
  }

  return (
    <aside className="panel-right">
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='detail'?'active':''}`} onClick={() => setTab('detail')}>County Detail</button>
        <button className={`tab-btn ${tab==='rankings'?'active':''}`} onClick={() => setTab('rankings')}>Rankings</button>
      </div>

      {tab === 'detail' && (
        county ? (
          <div className="county-detail">
            <div className="county-detail-header">
              <div className="county-detail-name">{county.county_name}<span> County</span></div>
              <div className="county-detail-sub">
                <span className="county-detail-tag">FIPS {county.fips}</span>
                <span className="county-detail-tag">{fmtH(county.owner_occ_rate,'pct')} homeowners</span>
              </div>
            </div>
            {HOUSING_METRICS.map(m => {
              const s = stats[m.key]
              const val = county[m.key]
              const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
              const rank = getRank(counties, county.fips, m.key, false)
              return (
                <div key={m.key} className={`metric-row ${m.key === activeIndicator ? 'highlight' : ''}`}>
                  <div className="metric-row-info">
                    <div className="metric-row-label">{m.label}</div>
                    <div className="metric-row-source">ACS 5-Year 2022</div>
                    {s && val != null && <div className="metric-row-bar-wrap"><div className="metric-row-bar" style={{ width:`${barW}%`, background: INDICATOR_COLORS[m.key] }} /></div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="metric-row-value">{fmtH(val, m.format)}</div>
                    {rank != null && <div style={{ fontSize:'0.6rem', fontFamily:'var(--font-mono)', color:'var(--cream-faint)', marginTop:2 }}>#{rank} of {counties.filter(c=>c[m.key]!=null).length}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="county-panel-empty">
            <div className="county-panel-empty-icon">⬡</div>
            <div className="county-panel-empty-text">Hover over a county<br />to preview data.<br /><br />Click to pin<br />full details here.</div>
          </div>
        )
      )}

      {tab === 'rankings' && (
        <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
          <div className="rankings-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width:28 }}>#</th>
                  <th onClick={() => handleSort('county_name')}>County {sortKey==='county_name'?(sortAsc?'↑':'↓'):''}</th>
                  <th onClick={() => handleSort(activeIndicator)}>
                    {HOUSING_METRICS.find(m=>m.key===activeIndicator)?.label} {sortKey===activeIndicator?(sortAsc?'↑':'↓'):''}
                  </th>
                  <th onClick={() => handleSort('median_home_value')}>Home Value {sortKey==='median_home_value'?(sortAsc?'↑':'↓'):''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => {
                  const m = HOUSING_METRICS.find(x => x.key === activeIndicator)
                  return (
                    <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                      <td className="rank">{i+1}</td>
                      <td>{c.county_name}</td>
                      <td className="mono">{fmtH(c[activeIndicator], m?.format)}</td>
                      <td className="mono" style={{ color:'var(--cream-faint)' }}>{fmtH(c.median_home_value,'dollars')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button className="download-btn" onClick={downloadCsv}>↓ Download CSV — 92 counties</button>
        </div>
      )}
    </aside>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function HousingDashboard() {
  const [counties, setCounties] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('median_home_value')
  const [selectedCounty, setSelectedCounty]   = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/housing_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = HOUSING_METRICS.find(m => m.key === activeIndicator)

  return (
    <div className="layout">
      {!loading && !error && (
        <HousingLeftPanel counties={counties} activeIndicator={activeIndicator} onIndicatorChange={setActiveIndicator} />
      )}
      <main className="map-area">
        <div className="map-toolbar">
          <div>
            <div className="map-toolbar-title">{activeMeta?.label || 'Indiana Housing Map'}</div>
            <div className="map-toolbar-subtitle">
              {selectedCounty
                ? `${selectedCounty.county_name} County selected — click again to deselect`
                : 'Hover to preview · click to pin county details'}
            </div>
          </div>
        </div>
        <div className="map-container">
          {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading housing data...</div></div>}
          {error && <div className="map-loading"><div style={{ color:'var(--red-accent)', fontSize:'0.8rem', textAlign:'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
          {!loading && !error && (
            <HousingMap counties={counties} indicator={activeIndicator} selectedFips={selectedCounty?.fips} onCountyClick={handleCountyClick} />
          )}
        </div>
      </main>
      {!loading && !error && (
        <HousingRightPanel county={selectedCounty} counties={counties} activeIndicator={activeIndicator} />
      )}
    </div>
  )
}
