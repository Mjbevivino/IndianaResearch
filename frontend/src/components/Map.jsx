import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const VW = 600
const VH = 560

const SCALES = {
  median_household_income: d3.schemeBlues[7],
  poverty_rate:            d3.schemeReds[7],
  unemployment_rate:       d3.schemeOranges[7],
  lfp_rate:                d3.schemeGreens[7],
  bachelors_rate:          d3.schemePurples[7],
  median_home_value:       d3.schemeYlOrBr[7],
  total_population:        d3.schemeGreys[7],
}

export default function Map({ counties, indicator, selectedFips, onCountyClick }) {
  const svgRef  = useRef(null)
  const [geo, setGeo]         = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const dataMap = useRef({})

  useEffect(() => {
    d3.json(TOPO_URL).then(topo => {
      const all = topojson.feature(topo, topo.objects.counties)
      all.features = all.features.filter(f => f.id.startsWith('18'))
      setGeo(all)
    })
  }, [])

  useEffect(() => {
    dataMap.current = {}
    counties.forEach(c => { dataMap.current[c.fips] = c })
  }, [counties])

  useEffect(() => {
    if (!geo || !counties.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const projection = d3.geoAlbersUsa()
      .fitSize([VW - 40, VH - 40], geo)

    const path = d3.geoPath().projection(projection)
    const values = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    const scheme = SCALES[indicator] || d3.schemeBlues[7]
    const colorScale = d3.scaleQuantile().domain(values).range(scheme)

    svg.selectAll('path.county-path')
      .data(geo.features, d => d.id)
      .join('path')
      .attr('class', 'county-path')
      .attr('d', path)
      .attr('fill', d => {
        const c = dataMap.current[d.id]
        const v = c && c[indicator]
        return v != null ? colorScale(Number(v)) : '#1e3248'
      })
      .classed('selected', d => d.id === selectedFips)
      .on('mouseenter', (event, d) => {
        const c = dataMap.current[d.id]
        if (c) setTooltip({ x: event.clientX, y: event.clientY, county: c })
      })
      .on('mousemove', (event) => {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (event, d) => {
        const c = dataMap.current[d.id]
        if (c) onCountyClick && onCountyClick(c)
      })
  }, [geo, counties, indicator, selectedFips])

  const legendData = (() => {
    if (!counties.length) return null
    const vals = counties.map(c => c[indicator]).filter(v => v != null).map(Number)
    if (!vals.length) return null
    return { min: d3.min(vals), max: d3.max(vals) }
  })()

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        ref={svgRef}
        viewBox={"0 0 " + VW + " " + VH}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      />
      {tooltip && <Tooltip x={tooltip.x} y={tooltip.y} county={tooltip.county} />}
      {legendData && <MapLegend indicator={indicator} min={legendData.min} max={legendData.max} scheme={SCALES[indicator] || d3.schemeBlues[7]} />}
    </div>
  )
}

function Tooltip({ x, y, county }) {
  const fmt = (key, format) => {
    const v = county[key]
    if (v == null) return 'N/A'
    if (format === 'currency') return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (format === 'percent') return Number(v).toFixed(1) + '%'
    return Number(v).toLocaleString()
  }
  return (
    <div className="tooltip" style={{ left: Math.min(x + 16, window.innerWidth - 280), top: Math.max(y - 80, 8) }}>
      <div className="tooltip-county">{county.county_name} County</div>
      <div className="tooltip-rucc">{county.rucc_label || 'unknown'} - FIPS {county.fips}</div>
      <div className="tooltip-row"><span className="tooltip-label">Median Income</span><span className="tooltip-value">{fmt('median_household_income', 'currency')}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Unemployment</span><span className="tooltip-value">{fmt('unemployment_rate', 'percent')}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Poverty Rate</span><span className="tooltip-value">{fmt('poverty_rate', 'percent')}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Population</span><span className="tooltip-value">{fmt('total_population', 'number')}</span></div>
      <div className="tooltip-hint">click to pin details</div>
    </div>
  )
}

function MapLegend({ indicator, min, max, scheme }) {
  const LABELS = {
    median_household_income: { label: 'Median Income',    fmt: v => '$' + Math.round(v / 1000) + 'K' },
    poverty_rate:            { label: 'Poverty Rate',     fmt: v => v.toFixed(1) + '%' },
    unemployment_rate:       { label: 'Unemployment',     fmt: v => v.toFixed(1) + '%' },
    lfp_rate:                { label: 'LF Participation', fmt: v => v.toFixed(1) + '%' },
    bachelors_rate:          { label: 'Bachelors',        fmt: v => v.toFixed(1) + '%' },
    median_home_value:       { label: 'Home Value',       fmt: v => '$' + Math.round(v / 1000) + 'K' },
    total_population:        { label: 'Population',       fmt: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'K' },
  }
  const meta = LABELS[indicator] || { label: indicator, fmt: String }
  return (
    <div className="map-legend">
      <div className="legend-title">{meta.label}</div>
      <div className="legend-gradient" style={{ background: 'linear-gradient(to right, ' + scheme.join(', ') + ')' }} />
      <div className="legend-labels">
        <span>{meta.fmt(min)}</span>
        <span>{meta.fmt((min + max) / 2)}</span>
        <span>{meta.fmt(max)}</span>
      </div>
    </div>
  )
}
