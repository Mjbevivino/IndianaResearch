// components/EducationDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const EDU_METRICS = [
  { key: 'ela_math_proficient_pct', label: 'ELA & Math Proficiency', format: 'pct', unit: 'percent', higherIsBetter: true },
  { key: 'ela_proficient_pct',      label: 'ELA Proficiency',        format: 'pct', unit: 'percent', higherIsBetter: true },
  { key: 'math_proficient_pct',     label: 'Math Proficiency',       format: 'pct', unit: 'percent', higherIsBetter: true },
  { key: 'science_proficient_pct',  label: 'Science Proficiency',    format: 'pct', unit: 'percent', higherIsBetter: true },
  { key: 'grad_rate',               label: 'Graduation Rate',        format: 'pct', unit: 'percent', higherIsBetter: true },
  { key: 'chronic_absent_rate',     label: 'Chronic Absenteeism',    format: 'pct', unit: 'percent', higherIsBetter: false },
]

const INDICATOR_COLORS = {
  ela_math_proficient_pct: '#2e7d52',
  ela_proficient_pct:      '#1a6b8a',
  math_proficient_pct:     '#4a5fa8',
  science_proficient_pct:  '#7a3e9e',
  grad_rate:               '#3a8e4a',
  chronic_absent_rate:     '#c04040',
}

const SCALES = {
  ela_math_proficient_pct: d3.schemeGreens[7],
  ela_proficient_pct:      d3.schemeBlues[7],
  math_proficient_pct:     d3.schemePurples[7],
  science_proficient_pct:  d3.schemeOranges[7],
  grad_rate:               d3.schemeGreens[7],
  chronic_absent_rate:     d3.schemeReds[7],
}

function fmtEdu(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'pct') return `${(n * 100).toFixed(1)}%`
  return n.toFixed(1)
}

// ── Map ────────────────────────────────────────────────────────────────────────
function EduMap({ counties, indicator, selectedFips, onCountyClick }) {
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

    // For chronic absenteeism, higher = worse; flip scale
    const meta = EDU_METRICS.find(m => m.key === indicator)
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    const scheme = SCALES[indicator] || d3.schemeGreens[7]
    const colorScale = d3.scaleQuantile().domain(values).range(
      meta?.higherIsBetter === false ? [...scheme].reverse() : scheme
    )

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

  const legendData = (() => {
    if (!counties.length) return null
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!values.length) return null
    const [mn, mx] = d3.extent(values)
    return { min: mn, max: mx }
  })()

  const meta = EDU_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 280), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc" style={{ marginBottom: 8 }}>IDOE · ILEARN 2025</div>
          <div className="tooltip-row"><span className="tooltip-label">ELA & Math</span><span className="tooltip-value">{fmtEdu(tooltip.county.ela_math_proficient_pct,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Graduation Rate</span><span className="tooltip-value">{fmtEdu(tooltip.county.grad_rate,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Chronic Absent</span><span className="tooltip-value">{fmtEdu(tooltip.county.chronic_absent_rate,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Science</span><span className="tooltip-value">{fmtEdu(tooltip.county.science_proficient_pct,'pct')}</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label}</div>
          <div className="legend-gradient" style={{
            background: `linear-gradient(to right, ${
              meta.higherIsBetter === false
                ? [...(SCALES[indicator] || d3.schemeGreens[7])].reverse().join(', ')
                : (SCALES[indicator] || d3.schemeGreens[7]).join(', ')
            })`
          }} />
          <div className="legend-labels">
            <span>{(legendData.min * 100).toFixed(0)}%</span>
            <span>{((legendData.min + legendData.max) / 2 * 100).toFixed(0)}%</span>
            <span>{(legendData.max * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function EduLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    EDU_METRICS.forEach(m => {
      const vals = counties.map(c => c[m.key]).filter(v => v != null).map(Number)
      if (vals.length) {
        const sorted = [...vals].sort((a, b) => a - b)
        s[m.key] = {
          min: Math.min(...vals),
          max: Math.max(...vals),
          median: sorted[Math.floor(sorted.length / 2)],
          mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        }
      }
    })
    return s
  }, [counties])

  const activeMeta = EDU_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Education Indicator</div>
        <div className="indicator-list">
          {EDU_METRICS.map(m => (
            <button
              key={m.key}
              className={`indicator-btn ${activeIndicator === m.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(m.key)}
            >
              <div className="indicator-btn-swatch" style={{ background: INDICATOR_COLORS[m.key] }} />
              <div>
                <div>{m.label}</div>
                <div className="indicator-btn-meta">
                  {m.key.includes('proficient') ? 'ILEARN 2025 · Grades 3–8' :
                   m.key === 'grad_rate' ? 'IDOE 2025 · 4-year cohort' :
                   'IDOE 2024–25 · All grades'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeMeta && activeStat && (
        <div className="panel-section">
          <div className="panel-section-title">Indiana — {activeMeta.label}</div>
          <div className="stat-grid">
            <div className="stat-box"><div className="stat-box-value">{(activeStat.median * 100).toFixed(1)}%</div><div className="stat-box-label">Median county</div></div>
            <div className="stat-box"><div className="stat-box-value">{(activeStat.mean * 100).toFixed(1)}%</div><div className="stat-box-label">County avg</div></div>
            <div className="stat-box"><div className="stat-box-value">{(activeStat.min * 100).toFixed(1)}%</div><div className="stat-box-label">Lowest county</div></div>
            <div className="stat-box"><div className="stat-box-value">{(activeStat.max * 100).toFixed(1)}%</div><div className="stat-box-label">Highest county</div></div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">Data Sources</div>
        <div className="source-list">
          <div className="source-item">
            <div className="source-name">IDOE ILEARN 2025</div>
            <div className="source-desc">Grades 3–8 ELA, Math, Science proficiency by school corporation</div>
          </div>
          <div className="source-item">
            <div className="source-name">IDOE Graduation Rate 2025</div>
            <div className="source-desc">4-year adjusted cohort graduation rate, class of 2025</div>
          </div>
          <div className="source-item">
            <div className="source-name">IDOE Chronic Absenteeism 2024–25</div>
            <div className="source-desc">Students missing 10%+ of school days by corporation</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function EduRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    EDU_METRICS.forEach(m => {
      const vals = counties.map(c => c[m.key]).filter(v => v != null).map(Number)
      if (vals.length) s[m.key] = { min: Math.min(...vals), max: Math.max(...vals) }
    })
    return s
  }, [counties])

  const handleSort = key => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sortedCounties = useMemo(() => {
    const meta = EDU_METRICS.find(m => m.key === sortKey)
    const defaultDesc = meta?.higherIsBetter !== false
    return [...counties].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return (sortAsc ? 1 : -1) * (defaultDesc ? bv - av : av - bv) * (sortAsc ? -1 : 1)
    })
  }, [counties, sortKey, sortAsc])

  const downloadCsv = () => {
    const headers = ['fips','county_name',...EDU_METRICS.map(m => m.key),'total_population']
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','),...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_education_data.csv'
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
              </div>
            </div>
            <div className="county-metrics">
              {EDU_METRICS.map(m => {
                const val = county[m.key]
                const s = stats[m.key]
                const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
                const rank = getRank(counties, county.fips, m.key, m.higherIsBetter === false)
                return (
                  <div key={m.key} className={`metric-row ${m.key === activeIndicator ? 'highlight' : ''}`}>
                    <div className="metric-row-info">
                      <div className="metric-row-label">{m.label}</div>
                      <div className="metric-row-source">
                        {m.key.includes('proficient') ? 'ILEARN 2025' :
                         m.key === 'grad_rate' ? 'IDOE 2025' : 'IDOE 2024–25'}
                      </div>
                      {s && val != null && (
                        <div className="metric-row-bar-wrap">
                          <div className="metric-row-bar" style={{ width: `${barW}%` }} />
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="metric-row-value">{fmtEdu(val, m.format)}</div>
                      {rank != null && (
                        <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--cream-faint)', marginTop: 2 }}>
                          #{rank} of {counties.filter(c => c[m.key] != null).length}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
                  <th onClick={() => handleSort('county_name')}>County {sortKey==='county_name'?(sortAsc?'↑':'↓'):''}</th>
                  <th onClick={() => handleSort(activeIndicator)}>
                    {EDU_METRICS.find(m => m.key === activeIndicator)?.label} {sortKey===activeIndicator?(sortAsc?'↑':'↓'):''}
                  </th>
                  <th onClick={() => handleSort('grad_rate')}>Grad Rate {sortKey==='grad_rate'?(sortAsc?'↑':'↓'):''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => (
                  <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                    <td className="rank">{i + 1}</td>
                    <td>{c.county_name}</td>
                    <td className="mono">{fmtEdu(c[activeIndicator], EDU_METRICS.find(m => m.key === activeIndicator)?.format)}</td>
                    <td className="mono" style={{ color: 'var(--cream-faint)' }}>{fmtEdu(c.grad_rate, 'pct')}</td>
                  </tr>
                ))}
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
export default function EducationDashboard() {
  const [counties, setCounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('ela_math_proficient_pct')
  const [selectedCounty, setSelectedCounty] = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/education_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = EDU_METRICS.find(m => m.key === activeIndicator)

  return (
    <div className="layout">
      {!loading && !error && (
        <EduLeftPanel counties={counties} activeIndicator={activeIndicator} onIndicatorChange={setActiveIndicator} />
      )}
      <main className="map-area">
        <div className="map-toolbar">
          <div>
            <div className="map-toolbar-title">{activeMeta?.label || 'Indiana Education Map'}</div>
            <div className="map-toolbar-subtitle">
              {selectedCounty
                ? `${selectedCounty.county_name} County selected — click again to deselect`
                : 'Hover to preview · click to pin county details'}
            </div>
          </div>
        </div>
        <div className="map-container">
          {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading education data...</div></div>}
          {error && <div className="map-loading"><div style={{ color: 'var(--red-accent)', fontSize: '0.8rem', textAlign: 'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
          {!loading && !error && (
            <EduMap counties={counties} indicator={activeIndicator} selectedFips={selectedCounty?.fips} onCountyClick={handleCountyClick} />
          )}
        </div>
      </main>
      {!loading && !error && (
        <EduRightPanel county={selectedCounty} counties={counties} activeIndicator={activeIndicator} />
      )}
    </div>
  )
}
