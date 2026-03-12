// components/DemographicsDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const DEMO_METRICS = [
  { key: 'total_population',     label: 'Total Population',          format: 'number',  unit: 'people',   higherIsBetter: null },
  { key: 'median_age',           label: 'Median Age',                format: 'decimal', unit: 'years',    higherIsBetter: null },
  { key: 'pct_under_18',         label: 'Population Under 18',       format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_65_plus',          label: 'Population 65+',            format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_white',            label: 'White (Non-Hispanic)',       format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_black',            label: 'Black or African American', format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_hispanic',         label: 'Hispanic or Latino',        format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_asian',            label: 'Asian',                     format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_foreign_born',     label: 'Foreign Born',              format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_moved_in_county',  label: 'Moved Within County',       format: 'pct',     unit: '% of pop', higherIsBetter: null },
  { key: 'pct_moved_from_state', label: 'Moved From Another State',  format: 'pct',     unit: '% of pop', higherIsBetter: null },
]

const INDICATOR_COLORS = {
  total_population:     '#4a8ec8',
  median_age:           '#c8a94a',
  pct_under_18:         '#3a9e6a',
  pct_65_plus:          '#9e4a7a',
  pct_white:            '#8a8a8a',
  pct_black:            '#4a6ec8',
  pct_hispanic:         '#c07030',
  pct_asian:            '#c04060',
  pct_foreign_born:     '#2a8a7a',
  pct_moved_in_county:  '#6a4ac8',
  pct_moved_from_state: '#c84a4a',
}

const SCALES = {
  total_population:     d3.schemeBlues[7],
  median_age:           d3.schemeYlOrRd[7],
  pct_under_18:         d3.schemeGreens[7],
  pct_65_plus:          d3.schemePurples[7],
  pct_white:            d3.schemeGreys[7],
  pct_black:            d3.schemeBlues[7],
  pct_hispanic:         d3.schemeOranges[7],
  pct_asian:            d3.schemeReds[7],
  pct_foreign_born:     d3.schemeGnBu[7],
  pct_moved_in_county:  d3.schemePurples[7],
  pct_moved_from_state: d3.schemeReds[7],
}

function fmtD(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'pct')     return `${n.toFixed(1)}%`
  if (format === 'decimal') return n.toFixed(1)
  if (format === 'number')  return n.toLocaleString()
  return n.toFixed(1)
}

// ── Map ────────────────────────────────────────────────────────────────────────
function DemoMap({ counties, indicator, selectedFips, onCountyClick }) {
  const svgRef  = useRef(null)
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

  const meta = DEMO_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 290), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc" style={{ marginBottom: 8 }}>ACS 5-Year 2022</div>
          <div className="tooltip-row"><span className="tooltip-label">Population</span><span className="tooltip-value">{fmtD(tooltip.county.total_population,'number')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Median Age</span><span className="tooltip-value">{fmtD(tooltip.county.median_age,'decimal')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">65+</span><span className="tooltip-value">{fmtD(tooltip.county.pct_65_plus,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Foreign Born</span><span className="tooltip-value">{fmtD(tooltip.county.pct_foreign_born,'pct')}</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label} ({meta.unit})</div>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${(SCALES[indicator]||d3.schemeBlues[7]).join(', ')})` }} />
          <div className="legend-labels">
            <span>{fmtD(legendData.min, meta.format)}</span>
            <span>{fmtD((legendData.min + legendData.max) / 2, meta.format)}</span>
            <span>{fmtD(legendData.max, meta.format)}</span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function DemoLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    DEMO_METRICS.forEach(m => {
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

  const activeMeta = DEMO_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  const fmtStat = v => {
    if (v == null) return 'N/A'
    return fmtD(v, activeMeta?.format)
  }

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Demographic Indicator</div>
        <div className="indicator-list">
          {DEMO_METRICS.map(m => (
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
            <div className="source-desc">American Community Survey population estimates. Age, race, ethnicity, nativity, and migration by county.</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function DemoRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    DEMO_METRICS.forEach(m => {
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
    const headers = ['fips','county_name',...DEMO_METRICS.map(m=>m.key)]
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','),...rows].join('\n')], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_demographics_data.csv'
    a.click()
  }

  // Race/ethnicity breakdown bar chart for county detail
  const raceMetrics = ['pct_white','pct_black','pct_hispanic','pct_asian']
  const raceLabels  = { pct_white:'White (Non-Hisp)', pct_black:'Black', pct_hispanic:'Hispanic', pct_asian:'Asian' }

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
                <span className="county-detail-tag">Pop. {Number(county.total_population).toLocaleString()}</span>
              </div>
            </div>

            {/* Key demo stats */}
            {DEMO_METRICS.filter(m => !['pct_white','pct_black','pct_hispanic','pct_asian'].includes(m.key)).map(m => {
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
                    <div className="metric-row-value">{fmtD(val, m.format)}</div>
                    {rank != null && <div style={{ fontSize:'0.6rem', fontFamily:'var(--font-mono)', color:'var(--cream-faint)', marginTop:2 }}>#{rank} of 92</div>}
                  </div>
                </div>
              )
            })}

            {/* Race/ethnicity section */}
            <div style={{ padding:'12px 20px 4px', fontSize:'0.65rem', letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--cream-faint)', fontFamily:'var(--font-mono)', borderTop:'1px solid var(--border)', marginTop:4 }}>
              Race &amp; Ethnicity
            </div>
            {raceMetrics.map(key => {
              const val = county[key]
              const barW = val != null ? Math.min(Number(val), 100) : 0
              return (
                <div key={key} className={`metric-row ${key === activeIndicator ? 'highlight' : ''}`} style={{ cursor:'default' }}>
                  <div className="metric-row-info">
                    <div className="metric-row-label" style={{ fontSize:'0.72rem' }}>{raceLabels[key]}</div>
                    <div className="metric-row-bar-wrap">
                      <div className="metric-row-bar" style={{ width:`${barW}%`, background: INDICATOR_COLORS[key] }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="metric-row-value">{fmtD(val,'pct')}</div>
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
                    {DEMO_METRICS.find(m=>m.key===activeIndicator)?.label} {sortKey===activeIndicator?(sortAsc?'↑':'↓'):''}
                  </th>
                  <th onClick={() => handleSort('total_population')}>Population {sortKey==='total_population'?(sortAsc?'↑':'↓'):''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => {
                  const m = DEMO_METRICS.find(x => x.key === activeIndicator)
                  return (
                    <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                      <td className="rank">{i+1}</td>
                      <td>{c.county_name}</td>
                      <td className="mono">{fmtD(c[activeIndicator], m?.format)}</td>
                      <td className="mono" style={{ color:'var(--cream-faint)' }}>{Number(c.total_population).toLocaleString()}</td>
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
export default function DemographicsDashboard() {
  const [counties, setCounties]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('total_population')
  const [selectedCounty, setSelectedCounty]   = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/demographics_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = DEMO_METRICS.find(m => m.key === activeIndicator)

  return (
    <div className="layout">
      {!loading && !error && (
        <DemoLeftPanel counties={counties} activeIndicator={activeIndicator} onIndicatorChange={setActiveIndicator} />
      )}
      <main className="map-area">
        <div className="map-toolbar">
          <div>
            <div className="map-toolbar-title">{activeMeta?.label || 'Indiana Demographics Map'}</div>
            <div className="map-toolbar-subtitle">
              {selectedCounty
                ? `${selectedCounty.county_name} County selected — click again to deselect`
                : 'Hover to preview · click to pin county details'}
            </div>
          </div>
        </div>
        <div className="map-container">
          {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading demographics data...</div></div>}
          {error && <div className="map-loading"><div style={{ color:'var(--red-accent)', fontSize:'0.8rem', textAlign:'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
          {!loading && !error && (
            <DemoMap counties={counties} indicator={activeIndicator} selectedFips={selectedCounty?.fips} onCountyClick={handleCountyClick} />
          )}
        </div>
      </main>
      {!loading && !error && (
        <DemoRightPanel county={selectedCounty} counties={counties} activeIndicator={activeIndicator} />
      )}
    </div>
  )
}
