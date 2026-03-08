// components/LeftPanel.jsx
import { formatValue } from '../utils/format'

const INDICATOR_COLORS = {
  median_household_income: '#3d8bcd',
  poverty_rate:            '#c04040',
  unemployment_rate:       '#d4750a',
  lfp_rate:                '#3a9e6a',
  bachelors_rate:          '#8060c0',
  median_home_value:       '#a07020',
  total_population:        '#607080',
}

export default function LeftPanel({ indicators, summary, activeIndicator, onIndicatorChange }) {
  const activeInfo = indicators.find(i => i.key === activeIndicator)

  return (
    <aside className="panel-left">

      {/* Indicator Selector */}
      <div className="panel-section">
        <div className="panel-section-title">Map Indicator</div>
        <div className="indicator-list">
          {indicators.map(ind => (
            <button
              key={ind.key}
              className={`indicator-btn ${activeIndicator === ind.key ? 'active' : ''}`}
              onClick={() => onIndicatorChange(ind.key)}
            >
              <div
                className="indicator-btn-swatch"
                style={{ background: INDICATOR_COLORS[ind.key] || '#607080' }}
              />
              <div>
                <div>{ind.label}</div>
                <div className="indicator-btn-meta">{ind.source}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* State Summary */}
      {activeInfo && summary[activeIndicator] && (
        <div className="panel-section">
          <div className="panel-section-title">Indiana — {activeInfo.label}</div>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="stat-box-value">
                {formatValue(summary[activeIndicator].median, activeInfo.format)}
              </div>
              <div className="stat-box-label">State median</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-value">
                {formatValue(summary[activeIndicator].mean, activeInfo.format)}
              </div>
              <div className="stat-box-label">Avg across counties</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-value">
                {formatValue(summary[activeIndicator].min, activeInfo.format)}
              </div>
              <div className="stat-box-label">Lowest county</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-value">
                {formatValue(summary[activeIndicator].max, activeInfo.format)}
              </div>
              <div className="stat-box-label">Highest county</div>
            </div>
          </div>
        </div>
      )}

      {/* About indicator */}
      {activeInfo && (
        <div className="panel-section">
          <div className="panel-section-title">About this indicator</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--cream-faint)', lineHeight: 1.6 }}>
            {activeInfo.description}
          </p>
        </div>
      )}

      {/* Data Sources */}
      <div className="panel-section">
        <div className="panel-section-title">Data Sources</div>
        <div className="source-list">
          <div className="source-item">
            <div className="source-name">U.S. CENSUS BUREAU</div>
            <div className="source-desc">ACS 5-Year Estimates, 2018–2022</div>
          </div>
          <div className="source-item">
            <div className="source-name">BLS LAUS</div>
            <div className="source-desc">Local Area Unemployment Statistics, 2023</div>
          </div>
          <div className="source-item">
            <div className="source-name">USDA ERS</div>
            <div className="source-desc">Rural-Urban Continuum Codes, 2023</div>
          </div>
        </div>
      </div>

    </aside>
  )
}
