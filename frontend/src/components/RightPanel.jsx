import { useState, useMemo } from 'react'
import { formatValue, getRank, normalize } from '../utils/format'

const METRICS = [
  { key: 'median_household_income', label: 'Median Household Income', format: 'currency', source: 'Census ACS', higherIsBetter: true },
  { key: 'poverty_rate',            label: 'Poverty Rate',            format: 'percent',  source: 'Census ACS', higherIsBetter: false },
  { key: 'unemployment_rate',       label: 'Unemployment Rate',       format: 'percent',  source: 'BLS LAUS',   higherIsBetter: false },
  { key: 'lfp_rate',                label: 'Labor Force Participation',format: 'percent',  source: 'Census ACS', higherIsBetter: true },
  { key: 'bachelors_rate',          label: "Bachelor's Degree",       format: 'percent',  source: 'Census ACS', higherIsBetter: true },
  { key: 'median_home_value',       label: 'Median Home Value',       format: 'currency', source: 'Census ACS', higherIsBetter: null },
  { key: 'total_population',        label: 'Total Population',        format: 'number',   source: 'Census ACS', higherIsBetter: null },
  { key: 'labor_force',             label: 'Labor Force Size',        format: 'number',   source: 'BLS LAUS',   higherIsBetter: null },
]

export default function RightPanel({ county, counties, activeIndicator }) {
  const [tab, setTab] = useState('detail')
  const [sortKey, setSortKey] = useState(activeIndicator)
  const [sortAsc, setSortAsc] = useState(false)

  const stats = useMemo(() => {
    const s = {}
    METRICS.forEach(m => {
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
    const headers = ['fips', 'county_name', ...METRICS.map(m => m.key), 'rucc_code', 'rucc_label']
    const rows = counties.map(c => headers.map(h => c[h] ?? '').join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'indiana_counties_economic_data.csv'
    a.click()
  }

  return (
    <aside className="panel-right">
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'detail' ? 'active' : ''}`} onClick={() => setTab('detail')}>County Detail</button>
        <button className={`tab-btn ${tab === 'rankings' ? 'active' : ''}`} onClick={() => setTab('rankings')}>Rankings</button>
      </div>
      {tab === 'detail' && (county ? <CountyDetail county={county} counties={counties} stats={stats} activeIndicator={activeIndicator} /> : <EmptyState />)}
      {tab === 'rankings' && <RankingsTable counties={sortedCounties} metrics={METRICS} sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} selectedFips={county?.fips} onDownload={downloadCsv} activeIndicator={activeIndicator} />}
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="county-panel-empty">
      <div className="county-panel-empty-icon">⬡</div>
      <div className="county-panel-empty-text">Hover over a county<br />to preview data.<br /><br />Click to pin<br />full details here.</div>
    </div>
  )
}

function CountyDetail({ county, counties, stats, activeIndicator }) {
  return (
    <div className="county-detail">
      <div className="county-detail-header">
        <div className="county-detail-name">{county.county_name}<span> County</span></div>
        <div className="county-detail-sub">
          <span className="county-detail-tag">FIPS {county.fips}</span>
          <span className="county-detail-tag">{county.rucc_label || 'Unknown'}</span>
          {county.is_metro && <span className="county-detail-tag">Metro</span>}
          {county.is_rural && <span className="county-detail-tag">Rural</span>}
        </div>
      </div>
      <div className="county-metrics">
        {METRICS.map(m => {
          const val  = county[m.key]
          const s    = stats[m.key]
          const barW = s && val != null ? normalize(Number(val), s.min, s.max) * 100 : 0
          const rank = getRank(counties, county.fips, m.key, m.higherIsBetter === false)
          return (
            <div key={m.key} className={`metric-row ${m.key === activeIndicator ? 'highlight' : ''}`}>
              <div className="metric-row-info">
                <div className="metric-row-label">{m.label}</div>
                <div className="metric-row-source">{m.source}</div>
                {s && val != null && <div className="metric-row-bar-wrap"><div className="metric-row-bar" style={{ width: `${barW}%` }} /></div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="metric-row-value">{formatValue(val, m.format)}</div>
                {rank != null && <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--cream-faint)', marginTop: 2 }}>#{rank} of {counties.filter(c => c[m.key] != null).length}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RankingsTable({ counties, metrics, sortKey, sortAsc, onSort, selectedFips, onDownload, activeIndicator }) {
  const activeMeta = metrics.find(m => m.key === activeIndicator) || metrics[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rankings-table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th onClick={() => onSort('county_name')}>County {sortKey === 'county_name' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => onSort(activeIndicator)}>{activeMeta.label} {sortKey === activeIndicator ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => onSort('total_population')}>Pop. {sortKey === 'total_population' ? (sortAsc ? '↑' : '↓') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {counties.map((c, i) => (
              <tr key={c.fips} className={c.fips === selectedFips ? 'selected' : ''}>
                <td className="rank">{i + 1}</td>
                <td>{c.county_name}</td>
                <td className="mono">{formatValue(c[activeIndicator], activeMeta.format)}</td>
                <td className="mono" style={{ color: 'var(--cream-faint)' }}>{formatValue(c.total_population, 'number')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="download-btn" onClick={onDownload}>↓ Download CSV — all 92 counties</button>
    </div>
  )
}
