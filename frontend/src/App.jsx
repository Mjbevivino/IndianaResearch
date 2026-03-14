import { useState } from 'react'
import { useData } from './hooks/useData'
import Map from './components/Map'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import HealthDashboard from './components/HealthDashboard'
import CrimeDashboard from './components/CrimeDashboard'
import EducationDashboard from './components/EducationDashboard'
import IndustryDashboard from './components/IndustryDashboard'
import HousingDashboard from './components/HousingDashboard'
import DemographicsDashboard from './components/DemographicsDashboard'
import ElectionLab from './components/ElectionLab'

export default function App() {
  const { counties, indicators, summary, loading, error } = useData()
  const [activeIndicator, setActiveIndicator] = useState('median_household_income')
  const [selectedCounty, setSelectedCounty] = useState(null)
  const [page, setPage] = useState('election')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  const DATA_PAGES = [
    { id: 'economics', label: 'Economics' },
    { id: 'industry',  label: 'Industry & Labor' },
    { id: 'housing',   label: 'Housing' },
    { id: 'demographics', label: 'Demographics' },
    { id: 'health',    label: 'Health' },
    { id: 'crime',     label: 'Crime' },
    { id: 'education', label: 'Education' },
  ]

  const isDataPage = DATA_PAGES.some(p => p.id === page)
  const currentDataLabel = DATA_PAGES.find(p => p.id === page)?.label || 'Data Explorer'

  const navBtnStyle = (active) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '6px 14px',
    background: active ? 'var(--amber)' : 'none',
    color: active ? 'var(--ink)' : 'var(--cream-faint)',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'all 180ms ease',
  })

  return (
    <>
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-name">Hoosier<span>Data</span>Lab</div>
          <div className="header-logo-tag">Indiana · 92 Counties</div>
        </div>
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={() => setPage('election')}
            style={navBtnStyle(page === 'election')}
          >
            Election Lab
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                ...navBtnStyle(isDataPage),
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isDataPage ? currentDataLabel : 'Data Explorer'}
              <span style={{ fontSize: '0.5rem', marginLeft: 2 }}>{dropdownOpen ? '▲' : '▼'}</span>
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#111',
                border: '1px solid var(--border)',
                borderRadius: 4,
                minWidth: 180,
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {DATA_PAGES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPage(p.id); setDropdownOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '8px 14px',
                      background: page === p.id ? 'var(--amber)' : 'transparent',
                      color: page === p.id ? 'var(--ink)' : 'var(--cream-faint)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => { if (page !== p.id) e.target.style.background = '#1a1a1a' }}
                    onMouseLeave={e => { if (page !== p.id) e.target.style.background = 'transparent' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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


      {page === 'election' && <ElectionLab />}
      {page === 'health' && <HealthDashboard />}
      {page === 'crime'  && <CrimeDashboard />}
      {page === 'education' && <EducationDashboard />}
      {page === 'industry'  && <IndustryDashboard />}
      {page === 'housing'   && <HousingDashboard />}
      {page === 'demographics' && <DemographicsDashboard />}

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