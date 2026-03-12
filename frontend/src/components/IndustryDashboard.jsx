// components/IndustryDashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import { getRank, normalize } from '../utils/format'

const BASE = import.meta.env.BASE_URL
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

const INDUSTRY_METRICS = [
  { key: 'avg_annual_wage',  label: 'Avg Annual Wage',             format: 'dollars', unit: 'dollars',  higherIsBetter: true },
  { key: 'total_emp',        label: 'Total Employment',            format: 'number',  unit: 'workers',  higherIsBetter: true },
  { key: 'share_31_33',      label: 'Manufacturing Share',         format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_62',         label: 'Health Care Share',           format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_44_45',      label: 'Retail Trade Share',          format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_72',         label: 'Food & Accommodation Share',  format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_48_49',      label: 'Transportation Share',        format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_23',         label: 'Construction Share',          format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_54',         label: 'Professional Services Share', format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_11',         label: 'Agriculture Share',           format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_52',         label: 'Finance & Insurance Share',   format: 'pct',     unit: '% of jobs', higherIsBetter: null },
  { key: 'share_61',         label: 'Educational Services Share',  format: 'pct',     unit: '% of jobs', higherIsBetter: null },
]

const INDICATOR_COLORS = {
  avg_annual_wage:  '#c8a94a',
  total_emp:        '#4a8ec8',
  share_31_33:      '#7a4a9e',
  share_62:         '#3a9e6a',
  share_44_45:      '#c07030',
  share_72:         '#c04060',
  share_48_49:      '#4060c0',
  share_23:         '#8a6030',
  share_54:         '#2a7a8a',
  share_11:         '#5a8a3a',
  share_52:         '#8a3a5a',
  share_61:         '#5a6a9e',
}

const SCALES = {
  avg_annual_wage: d3.schemeYlOrRd[7],
  total_emp:       d3.schemeBlues[7],
  share_31_33:     d3.schemePurples[7],
  share_62:        d3.schemeGreens[7],
  share_44_45:     d3.schemeOranges[7],
  share_72:        d3.schemeReds[7],
  share_48_49:     d3.schemeBlues[7],
  share_23:        d3.schemeOranges[7],
  share_54:        d3.schemePurples[7],
  share_11:        d3.schemeGreens[7],
  share_52:        d3.schemeReds[7],
  share_61:        d3.schemeBlues[7],
}

function fmtInd(value, format) {
  if (value == null) return 'N/A'
  const n = Number(value)
  if (isNaN(n)) return 'N/A'
  if (format === 'dollars') return `$${Math.round(n).toLocaleString()}`
  if (format === 'pct')     return `${n.toFixed(1)}%`
  if (format === 'number')  return n.toLocaleString()
  return n.toFixed(1)
}

// ── Map ────────────────────────────────────────────────────────────────────────
function IndustryMap({ counties, indicator, selectedFips, onCountyClick }) {
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

  const legendData = (() => {
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!values.length) return null
    return { min: Math.min(...values), max: Math.max(...values) }
  })()

  const meta = INDUSTRY_METRICS.find(m => m.key === indicator)

  return (
    <>
      <svg ref={svgRef} className="map-svg" />
      {tooltip && (
        <div className="tooltip" style={{ left: Math.min(tooltip.x + 16, window.innerWidth - 290), top: Math.max(tooltip.y - 80, 8) }}>
          <div className="tooltip-county">{tooltip.county.county_name} County</div>
          <div className="tooltip-rucc" style={{ marginBottom: 8 }}>Census CBP 2022</div>
          <div className="tooltip-row"><span className="tooltip-label">Avg Annual Wage</span><span className="tooltip-value">{fmtInd(tooltip.county.avg_annual_wage,'dollars')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Total Employment</span><span className="tooltip-value">{fmtInd(tooltip.county.total_emp,'number')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Manufacturing</span><span className="tooltip-value">{fmtInd(tooltip.county.share_31_33,'pct')}</span></div>
          <div className="tooltip-row"><span className="tooltip-label">Health Care</span><span className="tooltip-value">{fmtInd(tooltip.county.share_62,'pct')}</span></div>
          <div className="tooltip-hint">click to pin details →</div>
        </div>
      )}
      {legendData && meta && (
        <div className="map-legend">
          <div className="legend-title">{meta.label} ({meta.unit})</div>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${(SCALES[indicator]||d3.schemeBlues[7]).join(', ')})` }} />
          <div className="legend-labels">
            <span>{meta.format==='dollars' ? `$${Math.round(legendData.min/1000)}k` : meta.format==='pct' ? `${legendData.min.toFixed(0)}%` : legendData.min.toLocaleString()}</span>
            <span>{meta.format==='dollars' ? `$${Math.round((legendData.min+legendData.max)/2000)}k` : meta.format==='pct' ? `${((legendData.min+legendData.max)/2).toFixed(0)}%` : Math.round((legendData.min+legendData.max)/2).toLocaleString()}</span>
            <span>{meta.format==='dollars' ? `$${Math.round(legendData.max/1000)}k` : meta.format==='pct' ? `${legendData.max.toFixed(0)}%` : legendData.max.toLocaleString()}</span>
          </div>
        </div>
      )}
    </>
  )
}

// ── Left Panel ─────────────────────────────────────────────────────────────────
function IndustryLeftPanel({ counties, activeIndicator, onIndicatorChange }) {
  const stats = useMemo(() => {
    const s = {}
    INDUSTRY_METRICS.forEach(m => {
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

  const activeMeta = INDUSTRY_METRICS.find(m => m.key === activeIndicator)
  const activeStat = stats[activeIndicator]

  const fmtStat = (v) => {
    if (v == null) return 'N/A'
    if (activeMeta?.format === 'dollars') return `$${Math.round(v).toLocaleString()}`
    if (activeMeta?.format === 'pct')     return `${v.toFixed(1)}%`
    return Math.round(v).toLocaleString()
  }

  return (
    <aside className="panel-left">
      <div className="panel-section">
        <div className="panel-section-title">Industry Indicator</div>
        <div className="indicator-list">
          {INDUSTRY_METRICS.map(m => (
            <button
              key={m.key}
              className={`indicator-btn ${activeIndicator === m.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(m.key)}
            >
              <div className="indicator-btn-swatch" style={{ background: INDICATOR_COLORS[m.key] }} />
              <div>
                <div>{m.label}</div>
                <div className="indicator-btn-meta">CBP 2022 · {m.unit}</div>
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
            <div className="source-name">Census County Business Patterns 2022</div>
            <div className="source-desc">Employment, establishments, and payroll by NAICS industry sector. Excludes self-employed, government, and farm workers.</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Right Panel ────────────────────────────────────────────────────────────────
function IndustryRightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    INDUSTRY_METRICS.forEach(m => {
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
    const headers = ['fips','county_name','avg_annual_wage','total_emp',...INDUSTRY_METRICS.slice(2).map(m=>m.key)]
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','),...rows].join('\n')], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_industry_data.csv'
    a.click()
  }

  // For county detail: show industry composition as a bar chart
  const topSectors = useMemo(() => {
    if (!county) return []
    return INDUSTRY_METRICS
      .filter(m => m.format === 'pct' && county[m.key] != null)
      .map(m => ({ ...m, value: Number(county[m.key]) }))
      .sort((a, b) => b.value - a.value)
  }, [county])

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
                <span className="county-detail-tag">{fmtInd(county.total_emp,'number')} workers</span>
              </div>
            </div>

            {/* Wage + total employment */}
            {['avg_annual_wage','total_emp'].map(key => {
              const m = INDUSTRY_METRICS.find(x => x.key === key)
              const s = stats[key]
              const val = county[key]
              const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
              const rank = getRank(counties, county.fips, key, false)
              return (
                <div key={key} className={`metric-row ${key === activeIndicator ? 'highlight' : ''}`}>
                  <div className="metric-row-info">
                    <div className="metric-row-label">{m.label}</div>
                    <div className="metric-row-source">Census CBP 2022</div>
                    {s && val != null && <div className="metric-row-bar-wrap"><div className="metric-row-bar" style={{ width:`${barW}%` }} /></div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="metric-row-value">{fmtInd(val, m.format)}</div>
                    {rank != null && <div style={{ fontSize:'0.6rem', fontFamily:'var(--font-mono)', color:'var(--cream-faint)', marginTop:2 }}>#{rank} of {counties.filter(c=>c[key]!=null).length}</div>}
                  </div>
                </div>
              )
            })}

            {/* Industry composition */}
            <div style={{ padding:'12px 20px 4px', fontSize:'0.65rem', letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--cream-faint)', fontFamily:'var(--font-mono)', borderTop:'1px solid var(--border)', marginTop:4 }}>
              Industry Composition
            </div>
            {topSectors.map(m => {
              const maxShare = Math.max(...topSectors.map(x => x.value))
              const barW = maxShare > 0 ? (m.value / maxShare) * 100 : 0
              return (
                <div key={m.key} className={`metric-row ${m.key === activeIndicator ? 'highlight' : ''}`} style={{ cursor:'default' }}>
                  <div className="metric-row-info">
                    <div className="metric-row-label" style={{ fontSize:'0.72rem' }}>{m.label.replace(' Share','')}</div>
                    <div className="metric-row-bar-wrap">
                      <div className="metric-row-bar" style={{ width:`${barW}%`, background: INDICATOR_COLORS[m.key] || 'var(--amber)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="metric-row-value">{fmtInd(m.value,'pct')}</div>
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
                    {INDUSTRY_METRICS.find(m=>m.key===activeIndicator)?.label} {sortKey===activeIndicator?(sortAsc?'↑':'↓'):''}
                  </th>
                  <th onClick={() => handleSort('avg_annual_wage')}>Avg Wage {sortKey==='avg_annual_wage'?(sortAsc?'↑':'↓'):''}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCounties.map((c, i) => {
                  const m = INDUSTRY_METRICS.find(x => x.key === activeIndicator)
                  return (
                    <tr key={c.fips} className={c.fips === county?.fips ? 'selected' : ''}>
                      <td className="rank">{i+1}</td>
                      <td>{c.county_name}</td>
                      <td className="mono">{fmtInd(c[activeIndicator], m?.format)}</td>
                      <td className="mono" style={{ color:'var(--cream-faint)' }}>{fmtInd(c.avg_annual_wage,'dollars')}</td>
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
export default function IndustryDashboard() {
  const [counties, setCounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeIndicator, setActiveIndicator] = useState('share_31_33')
  const [selectedCounty, setSelectedCounty] = useState(null)

  useEffect(() => {
    fetch(`${BASE}data/industry_counties.json`)
      .then(r => r.json())
      .then(data => { setCounties(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const activeMeta = INDUSTRY_METRICS.find(m => m.key === activeIndicator)

  return (
    <div className="layout">
      {!loading && !error && (
        <IndustryLeftPanel counties={counties} activeIndicator={activeIndicator} onIndicatorChange={setActiveIndicator} />
      )}
      <main className="map-area">
        <div className="map-toolbar">
          <div>
            <div className="map-toolbar-title">{activeMeta?.label || 'Indiana Industry & Labor Map'}</div>
            <div className="map-toolbar-subtitle">
              {selectedCounty
                ? `${selectedCounty.county_name} County selected — click again to deselect`
                : 'Hover to preview · click to pin county details'}
            </div>
          </div>
        </div>
        <div className="map-container">
          {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading industry data...</div></div>}
          {error && <div className="map-loading"><div style={{ color:'var(--red-accent)', fontSize:'0.8rem', textAlign:'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
          {!loading && !error && (
            <IndustryMap counties={counties} indicator={activeIndicator} selectedFips={selectedCounty?.fips} onCountyClick={handleCountyClick} />
          )}
        </div>
      </main>
      {!loading && !error && (
        <IndustryRightPanel county={selectedCounty} counties={counties} activeIndicator={activeIndicator} />
      )}
    </div>
  )
}
