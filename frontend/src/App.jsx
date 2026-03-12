import { useState } from 'react'
import { useData } from './hooks/useData'
import Map from './components/Map'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import HealthDashboard from './components/HealthDashboard'
import CrimeDashboard from './components/CrimeDashboard'
import EducationDashboard from './components/EducationDashboard'
import IndustryDashboard from './components/IndustryDashboard'

export default function App() {
  const { counties, indicators, summary, loading, error } = useData()
  const [activeIndicator, setActiveIndicator] = useState('median_household_income')
  const [selectedCounty, setSelectedCounty] = useState(null)
  const [page, setPage] = useState('economics')

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const NAV = [
    { id: 'economics', label: 'Economics' },
    { id: 'industry',  label: 'Industry & Labor' },
    { id: 'health',    label: 'Health' },
    { id: 'crime',     label: 'Crime' },
    { id: 'education', label: 'Education' },
  ]

  return (
    <>
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-name">Hoosier<span>Data</span>Lab</div>
          <div className="header-logo-tag">Indiana · 92 Counties</div>
        </div>
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {NAV.map(p => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 14px',
                background: page === p.id ? 'var(--amber)' : 'none',
                color: page === p.id ? 'var(--ink)' : 'var(--cream-faint)',
                border: page === p.id ? 'none' : '1px solid var(--border)',
                borderRadius: '2px',
                cursor: 'pointer',
                transition: 'all 180ms ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="header-meta">
          <span>
            <span className="status-dot" />
            {loading ? 'Loading...' : error ? 'Error' : `${counties.length} counties`}
          </span>
          <span>Census · BLS · CHR · NIBRS</span>
          <a href="https://github.com/Mjbevivino/IndianaResearch" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>

      {page === 'health' && <HealthDashboard />}
      {page === 'crime'  && <CrimeDashboard />}
      {page === 'education' && <EducationDashboard />}
      {page === 'industry'  && <IndustryDashboard />}

      {page === 'economics' && (
        <div className="layout">
          {!loading && !error && (
            <LeftPanel indicators={indicators} summary={summary} activeIndicator={activeIndicator} onIndicatorChange={setActiveIndicator} />
          )}
          <main className="map-area">
            <div className="map-toolbar">
              <div>
                <div className="map-toolbar-title">
                  {indicators.find(i => i.key === activeIndicator)?.label || 'Indiana Economic Map'}
                </div>
                <div className="map-toolbar-subtitle">
                  {selectedCounty
                    ? `${selectedCounty.county_name} County selected — click again to deselect`
                    : 'Hover to preview · click to pin county details'}
                </div>
              </div>
            </div>
            <div className="map-container">
              {loading && <div className="map-loading"><div className="spinner" /><div className="map-loading-text">Loading county data...</div></div>}
              {error && <div className="map-loading"><div style={{ color: 'var(--red-accent)', fontSize: '0.8rem', textAlign: 'center' }}><strong>Error loading data</strong><br />{error}</div></div>}
              {!loading && !error && (
                <Map counties={counties} indicator={activeIndicator} selectedFips={selectedCounty?.fips} onCountyClick={handleCountyClick} onCountyHover={() => {}} />
              )}
            </div>
          </main>
          {!loading && !error && (
            <RightPanel county={selectedCounty} counties={counties} activeIndicator={activeIndicator} />
          )}
        </div>
      )}
    </>
  )
}
