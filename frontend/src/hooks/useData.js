import { useState, useEffect } from 'react'

export function useData() {
  const [counties, setCounties]     = useState([])
  const [indicators, setIndicators] = useState([])
  const [summary, setSummary]       = useState({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [cRes, iRes, sRes] = await Promise.all([
          fetch('/data/counties.json'),
          fetch('/data/indicators.json'),
          fetch('/data/summary.json'),
        ])
        const [c, i, s] = await Promise.all([cRes.json(), iRes.json(), sRes.json()])
        setCounties(c)
        setIndicators(i)
        setSummary(s)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { counties, indicators, summary, loading, error }
}
