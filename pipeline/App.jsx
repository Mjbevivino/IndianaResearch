// App.jsx
import { useState } from 'react'
import { useData } from './hooks/useData'
import Map from './components/Map'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'

export default function App() {
  const { counties, indicators, summary, loading, error } = useData()
  const [activeIndicator, setActiveIndicator] = useState('median_household_income')
  const [selectedCounty, setSelectedCounty]   = useState(null)

  const handleCountyClick = county => {
    setSelectedCounty(prev => prev?.fips === county.fips ? null : county)
  }

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-name">
            Hoosier<span>Data</span>Lab
          </div>
          <div className="header-logo-tag">Indiana · 92 Counties</div>
        </div>
        <div className="header-meta">
          <span>
            <span className="status-dot" />
            {loading ? 'Loading...' : error ? 'Error' : `${counties.length} counties loaded`}
          </span>
          <span>Census · BLS · USDA</span>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>

      {/* Main layout */}
      <div className="layout">

        {/* Left — indicator selector */}
        {!loading && !error && (
          <LeftPanel
            indicators={indicators}
            summary={summary}
            activeIndicator={activeIndicator}
            onIndicatorChange={setActiveIndicator}
          />
        )}

        {/* Center — map */}
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
            {loading && (
              <div className="map-loading">
                <div className="spinner" />
                <div className="map-loading-text">Loading county data...</div>
              </div>
            )}
            {error && (
              <div className="map-loading">
                <div style={{ color: 'var(--red-accent)', fontSize: '0.8rem', maxWidth: 360, textAlign: 'center' }}>
                  <strong>API Error</strong><br />{error}<br /><br />
                  Make sure the FastAPI server is running:<br />
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    uvicorn api.main:app --port 8000
                  </code>
                </div>
              </div>
            )}
            {!loading && !error && (
              <Map
                counties={counties}
                indicator={activeIndicator}
                selectedFips={selectedCounty?.fips}
                onCountyClick={handleCountyClick}
                onCountyHover={() => {}}
              />
            )}
          </div>
        </main>

        {/* Right — county detail / rankings */}
        {!loading && !error && (
          <RightPanel
            county={selectedCounty}
            counties={counties}
            activeIndicator={activeIndicator}
          />
        )}

      </div>
    </>
  )
}
