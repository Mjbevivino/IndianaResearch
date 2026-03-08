// components/Map.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const INDIANA_STATE_FIPS = '18'

// Color scales per indicator
const SCALES = {
  median_household_income: d3.schemeBlues[7],
  poverty_rate:            d3.schemeReds[7],
  unemployment_rate:       d3.schemeOranges[7],
  lfp_rate:                d3.schemeGreens[7],
  bachelors_rate:          d3.schemePurples[7],
  median_home_value:       d3.schemeYlOrBr[7],
  total_population:        d3.schemeGreys[7],
}

export default function Map({ counties, indicator, selectedFips, onCountyClick, onCountyHover }) {
  const svgRef    = useRef(null)
  const [geo, setGeo]     = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const dataMap   = useRef({})

  // Load TopoJSON once
  useEffect(() => {
    d3.json(TOPO_URL).then(topo => {
      const all = topojson.feature(topo, topo.objects.counties)
      all.features = all.features.filter(f => f.id.startsWith(INDIANA_STATE_FIPS))
      setGeo(all)
    }).catch(err => console.error('TopoJSON load failed:', err))
  }, [])

  // Build FIPS → county data lookup
  useEffect(() => {
    dataMap.current = {}
    counties.forEach(c => { dataMap.current[c.fips] = c })
  }, [counties])

  // Draw / update map
  useEffect(() => {
    if (!geo || !counties.length || !svgRef.current) return

    const svg    = d3.select(svgRef.current)
    const width  = svgRef.current.clientWidth  || 600
    const height = svgRef.current.clientHeight || 560

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    // Projection fitted to Indiana counties
    const projection = d3.geoAlbersUsa()
      .fitSize([width - 20, height - 20], geo)
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projection)

    // Color scale
    const values = counties
      .map(c => c[indicator])
      .filter(v => v != null)
      .map(Number)

    const extent = d3.extent(values)
    const scheme = SCALES[indicator] || d3.schemeBlues[7]
    const colorScale = d3.scaleQuantile()
      .domain(values)
      .range(scheme)

    // Draw counties
    const paths = svg.selectAll('path.county-path')
      .data(geo.features, d => d.id)

    paths.enter()
      .append('path')
      .attr('class', 'county-path')
      .merge(paths)
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
        onCountyHover?.(county)
      })
      .on('mousemove', function(event) {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', function() {
        setTooltip(null)
        onCountyHover?.(null)
      })
      .on('click', function(event, d) {
        const county = dataMap.current[d.id]
        if (county) onCountyClick?.(county)
      })

    paths.exit().remove()

    // Store extent for legend
    svg.node()._extent = extent
    svg.node()._colorScale = colorScale
    svg.node()._scheme = scheme

  }, [geo, counties, indicator, selectedFips])

  // Compute legend values
  const legendData = (() => {
    if (!counties.length) return null
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!values.length) return null
    const [mn, mx] = d3.extent(values)
    return { min: mn, max: mx }
  })()

  return (
    <>
      <svg ref={svgRef} className="map-svg" />

      {/* Tooltip */}
      {tooltip && (
        <Tooltip
          x={tooltip.x}
          y={tooltip.y}
          county={tooltip.county}
          indicator={indicator}
        />
      )}

      {/* Legend */}
      {legendData && (
        <MapLegend
          indicator={indicator}
          min={legendData.min}
          max={legendData.max}
          scheme={SCALES[indicator] || d3.schemeBlues[7]}
        />
      )}
    </>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ x, y, county, indicator }) {
  const fmt = (key, format) => {
    const v = county[key]
    if (v == null) return 'N/A'
    if (format === 'currency') return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (format === 'percent')  return Number(v).toFixed(1) + '%'
    if (format === 'number')   return Number(v).toLocaleString()
    return v
  }

  // Position tooltip to avoid viewport edges
  const left = x + 16
  const top  = y - 80

  return (
    <div
      className="tooltip"
      style={{ left: Math.min(left, window.innerWidth - 280), top: Math.max(top, 8) }}
    >
      <div className="tooltip-county">{county.county_name} County</div>
      <div className="tooltip-rucc">{county.rucc_label || '—'} · FIPS {county.fips}</div>

      <div className="tooltip-row">
        <span className="tooltip-label">Median Income</span>
        <span className="tooltip-value">{fmt('median_household_income', 'currency')}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Unemployment</span>
        <span className="tooltip-value">{fmt('unemployment_rate', 'percent')}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Poverty Rate</span>
        <span className="tooltip-value">{fmt('poverty_rate', 'percent')}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">Population</span>
        <span className="tooltip-value">{fmt('total_population', 'number')}</span>
      </div>

      <div className="tooltip-hint">click to pin details →</div>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
function MapLegend({ indicator, min, max, scheme }) {
  const LABELS = {
    median_household_income: { label: 'Median Income', fmt: v => '$' + Math.round(v / 1000) + 'K' },
    poverty_rate:            { label: 'Poverty Rate',  fmt: v => v.toFixed(1) + '%' },
    unemployment_rate:       { label: 'Unemployment',  fmt: v => v.toFixed(1) + '%' },
    lfp_rate:                { label: 'LF Participation', fmt: v => v.toFixed(1) + '%' },
    bachelors_rate:          { label: "Bachelor's",    fmt: v => v.toFixed(1) + '%' },
    median_home_value:       { label: 'Home Value',    fmt: v => '$' + Math.round(v / 1000) + 'K' },
    total_population:        { label: 'Population',    fmt: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : Math.round(v/1000)+'K' },
  }

  const meta = LABELS[indicator] || { label: indicator, fmt: v => v }

  // Build gradient from scheme
  const gradient = scheme.join(', ')

  return (
    <div className="map-legend">
      <div className="legend-title">{meta.label}</div>
      <div
        className="legend-gradient"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="legend-labels">
        <span>{meta.fmt(min)}</span>
        <span>{meta.fmt((min + max) / 2)}</span>
        <span>{meta.fmt(max)}</span>
      </div>
    </div>
  )
}
