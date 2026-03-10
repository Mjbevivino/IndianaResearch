// components/HealthDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { formatValue, getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const HEALTH_METRICS = [
  { key: 'drug_overdose_rate',           label: 'Drug Overdose Rate',          format: 'decimal', unit: 'per 100k', source: 'CHR 2024', higherIsBetter: false },
  { key: 'suicide_rate',                 label: 'Suicide Rate',                format: 'decimal', unit: 'per 100k', source: 'CHR 2024', higherIsBetter: false },
  { key: 'mental_unhealthy_days',        label: 'Mentally Unhealthy Days',     format: 'decimal', unit: 'days/mo',  source: 'CHR 2024', higherIsBetter: false },
  { key: 'mental_health_provider_rate',  label: 'Mental Health Providers',     format: 'decimal', unit: 'per 100k', source: 'CHR 2024', higherIsBetter: true },
  { key: 'life_expectancy',              label: 'Life Expectancy',             format: 'decimal', unit: 'years',    source: 'CHR 2024', higherIsBetter: true },
  { key: 'age_adjusted_death_rate',      label: 'Age-Adjusted Death Rate',     format: 'decimal', unit: 'per 100k', source: 'CHR 2024', higherIsBetter: false },
  { key: 'pct_frequent_mental_distress', label: '% Frequent Mental Distress',  format: 'percent', unit: '%',        source: 'CHR 2024', higherIsBetter: false },
  { key: 'pct_uninsured',                label: '% Uninsured',                 format: 'percent', unit: '%',        source: 'CHR 2024', higherIsBetter: false },
  { key: 'injury_death_rate',            label: 'Injury Death Rate',           format: 'decimal', unit: 'per 100k', source: 'CHR 2024', higherIsBetter: false },
]

const INDICATOR_COLORS = {
  drug_overdose_rate:           '#c04040',
  suicide_rate:                 '#8b2020',
  mental_unhealthy_days:        '#b05020',
  mental_health_provider_rate:  '#3a9e6a',
  life_expectancy:              '#3d8bcd',
  age_adjusted_death_rate:      '#9040a0',
  pct_frequent_mental_distress: '#c06040',
  pct_uninsured:                '#d4750a',
  injury_death_rate:            '#804040',
}

const SCALES = {
  drug_overdose_rate:           d3.schemeReds[7],
  suicide_rate:                 d3.schemeReds[7],
  mental_unhealthy_days:        d3.schemeOranges[7],
  mental_health_provider_rate:  d3.schemeGreens[7],
  life_expectancy:              d3.schemeBlues[7],
  age_adjusted_death_rate:      d3.schemePurples[7],
  pct_frequent_mental_distress: d3.schemeOranges[7],
  pct_uninsured:                d3.schemeOranges[7],
  injury_death_rate:            d3.schemeReds[7],
}

function fmtHealth(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'percent') return n.toFixed(1) + '%'
  if (format === 'decimal') return n.toFixed(1)
  return n.toFixed(1)
}

// ── Map ────────────────────────────────────────────────────────────────────────
function HealthMap({ counties, indicator, selectedFips, onCountyClick }) {
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
    const scheme = SCALES[indicator] || d3.schemeReds[7]
    const colorScale = d3.scaleQuantile().domain(values).range(scheme)
    const paths = svg.selectAll('path.county-path').data(geo.features, d => d.id)
    paths.enter().append('path').attr('class', 'county-path').merge(paths)
      .attr('d', path)
      .attr('fill', d => {
        const county = dataMap.current[d.id]
        const val = county?.[indicator]
        return val != null ? colorScale(Number(val)) : '#1e3248'
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

  const meta = HEALTH_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 280), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc">FIPS {tooltip.county.fips}</div>
          <div className="tooltip-row"><span className="tooltip-label">Drug Overdose Rate</span><span className="tooltip-value">{fmtHealth(tooltip.county.drug_overdose_rate, 'decimal')} / 100k</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Suicide Rate</span><span className="tooltip-value">{fmtHealth(tooltip.county.suicide_rate, 'decimal')} / 100k</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Life Expectancy</span><span className="tooltip-value">{fmtHealth(tooltip.county.life_expectancy, 'decimal')} yrs</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Mental Health Providers</span><span className="tooltip-value">{fmtHealth(tooltip.county.mental_health_provider_rate, 'decimal')} / 100k</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label} ({meta.unit})</div>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${(SCALES[indicator] || d3.schemeReds[7]).join(', ')})` }} />
          <div className="legend-labels">
            <span>{legendData.min.toFixed(1)}</span>
            <span>{((legendData.min + legendData.max) / 2).toFixed(1)}</span>
            <span>{legendData.max.toFixed(1)}</span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function HealthLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    HEALTH_METRICS.forEach(m => {
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

  const activeMeta = HEALTH_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Health Indicator</div>
        <div className="indicator-list">
          {HEALTH_METRICS.map(m => (
            <button
              key={m.key}
              className={`indicator-btn ${activeIndicator === m.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(m.key)}
            >
              <div className="indicator-btn-swatch" style={{ background: INDICATOR_COLORS[m.key] || '#607080' }} />
              <div>
                <div>{m.label}</div>
                <div className="indicator-btn-meta">{m.unit} · {m.source}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeMeta && activeStat && (
        <div className="panel-section">
          <div className="panel-section-title">Indiana — {activeMeta.label}</div>
          <div className="stat-grid">
            <div className="stat-box"><div className="stat-box-value">{activeStat.median.toFixed(1)}</div><div className="stat-box-label">State median</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.mean.toFixed(1)}</div><div className="stat-box-label">County avg</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.min.toFixed(1)}</div><div className="stat-box-label">{activeMeta.higherIsBetter ? 'Lowest' : 'Best'} county</div></div>
            <div className="stat-box"><div className="stat-box-value">{activeStat.max.toFixed(1)}</div><div className="stat-box-label">{activeMeta.higherIsBetter ? 'Highest' : 'Worst'} county</div></div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">Data Source</div>
        <div className="source-list">
          <div className="source-item">
            <div className="source-name">COUNTY HEALTH RANKINGS</div>
            <div className="source-desc">Robert Wood Johnson Foundation, 2024 Indiana Data</div>
          </div>
          <div className="source-item">
            <div className="source-name">CDC WONDER</div>
            <div className="source-desc">Underlying Cause of Death, 2018–2022</div>
          </div>
          <div className="source-item">
            <div className="source-name">SAMHSA</div>
            <div className="source-desc">Mental health provider counts, 2024</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function HealthRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    HEALTH_METRICS.forEach(m => {
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
    const headers = ['fips', 'county_name', ...HEALTH_METRICS.map(m => m.key)]
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_health_data.csv'
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
              </div>
            </div>
            <div className="county-metrics">
              {HEALTH_METRICS.map(m => {
                const val = county[m.key]
                const s = stats[m.key]
                const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
                const rank = getRank(counties, county.fips, m.key, m.higherIsBetter === false)
                const isActive = m.key === activeIndicator
                return (
                  <div key={m.key} className={`metric-row ${isActive ? 'highlight' : ''}`}>
                    <div className="metric-row-info">
                      <div className="metric-row-label">{m.label}</div>
                      <div className="metric-row-source">{m.source} · {m.unit}</div>
                      {s && val != null && <div className="metric-row-bar-wrap"><div className="metric-row-bar" style={{ width: `${barW}%` }} /></div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="metric-row-value">{fmtHealth(val, m.format)}</div>
                      {rank != null && <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--cream-faint)', marginTop: 2 }}>#{rank} of {counties.filter(c => c[m.key] != null).length}</div>}
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
                  <th onClick={() => handleSort('county_name')}>County {sortKey === 'county_name' ? (sortAsc ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort(activeIndicator)}>
                    {HEALTH_METRICS.find(m => m.key === activeIndicator)?.label} {sortKey === activeIndicator ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => handleSort('life_expectancy')}>Life Exp. {sortKey === 'life_expectancy' ? (sortAsc ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => {
                  const meta = HEALTH_METRICS.find(m => m.key === activeIndicator)
                  return (
                    <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                      <td className="rank">{i + 1}</td>
                      <td>{c.county_name}</td>
                      <td className="mono">{fmtHealth(c[activeIndicator], meta?.format)}</td>
                      <td className="mono" style={{ color: 'var(--cream-faint)' }}>{fmtHealth(c.life_expectancy, 'decimal')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button className="download-btn" onClick={downloadCsv}>↓ Download CSV — all 92 counties</button>
        </div>
      )}
    </aside>
  )
}

// ── Main HealthDashboard ───────────────────────────────────────────────────────
export default function HealthDashboard() {
  const [counties, setCounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('drug_overdose_rate')
  const [selectedCounty, setSelectedCounty] = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/health_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = HEALTH_METRICS.find(m => m.key === activeIndicator)

  return (
    <>
      <div className="layout">
        {!loading && !error && (
          <HealthLeftPanel
            counties={counties}
            activeIndicator={activeIndicator}
            onIndicatorChange={setActiveIndicator}
          />
        )}

        <main className="map-area">
          <div className="map-toolbar">
            <div>
              <div className="map-toolbar-title">
                {activeMeta?.label || 'Indiana Health Map'}
              </div>
              <div className="map-toolbar-subtitle">
                {selectedCounty
                  ? `${selectedCounty.county_name} County selected — click again to deselect`
                  : 'Hover to preview · click to pin county details'}
              </div>
            </div>
          </div>
          <div className="map-container">
            {loading && (
              <div className="map-loading">
                <div className="spinner" />
                <div className="map-loading-text">Loading health data...</div>
              </div>
            )}
            {error && (
              <div className="map-loading">
                <div style={{ color: 'var(--red-accent)', fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>Error loading data</strong><br />{error}
                </div>
              </div>
            )}
            {!loading && !error && (
              <HealthMap
                counties={counties}
                indicator={activeIndicator}
                selectedFips={selectedCounty?.fips}
                onCountyClick={handleCountyClick}
              />
            )}
          </div>
        </main>

        {!loading && !error && (
          <HealthRightPanel
            county={selectedCounty}
            counties={counties}
            activeIndicator={activeIndicator}
          />
        )}
      </div>
    </>
  )
}
