import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL;

export function useData() {
  const [counties, setCounties] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/counties.json`).then(r => r.json()),
      fetch(`${BASE}data/indicators.json`).then(r => r.json()),
      fetch(`${BASE}data/summary.json`).then(r => r.json()),
    ])
      .then(([c, i, s]) => {
        setCounties(c);
        setIndicators(i);
        setSummary(s);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { counties, indicators, summary, loading, error };
}
