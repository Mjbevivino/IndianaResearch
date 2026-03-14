import { useState, useEffect, useMemo, useCallback } from "react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Area, AreaChart
} from "recharts";

const YEARS = [2000, 2004, 2008, 2012, 2016, 2020, 2024];

function processCounties(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter(c => c && c.data && c.data.length > 0)
    .map(c => {
      const d = c.data.sort((a, b) => a.year - b.year);
      const latest = d[d.length - 1];
      const prior = d.length > 1 ? d[d.length - 2] : latest;
      const first = d[0];
      return {
        county_name: c.county_name,
        FIPS: String(c.FIPS),
        data: d,
        latestMargin: latest.margin,
        latestYear: latest.year,
        swing: +(latest.margin - prior.margin).toFixed(2),
        totalShift: +(latest.margin - first.margin).toFixed(2),
        classification:
          Math.abs(latest.margin) <= 5 ? "Toss-Up" :
          Math.abs(latest.margin) <= 15 ? (latest.margin > 0 ? "Lean R" : "Lean D") :
          latest.margin > 0 ? "Safe R" : "Safe D",
      };
    });
}

function classify(m) {
  if (Math.abs(m) <= 5) return { label: "Toss-Up", color: "#A78BFA" };
  if (m > 15) return { label: "Safe R", color: "#EF4444" };
  if (m > 0) return { label: "Lean R", color: "#FCA5A5" };
  if (m < -15) return { label: "Safe D", color: "#3B82F6" };
  return { label: "Lean D", color: "#93C5FD" };
}

const mColor = m => (m > 0 ? "#EF4444" : m < 0 ? "#3B82F6" : "#A78BFA");

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#e0e0e0" }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.year}</div>
      {d.dem_pct != null && <div style={{ color: "#3B82F6" }}>Dem: {Number(d.dem_pct).toFixed(1)}%</div>}
      {d.rep_pct != null && <div style={{ color: "#EF4444" }}>Rep: {Number(d.rep_pct).toFixed(1)}%</div>}
      {d.margin != null && (
        <div style={{ color: mColor(d.margin), fontWeight: 600, marginTop: 3, borderTop: "1px solid #444", paddingTop: 3 }}>
          Margin: {d.margin > 0 ? "R" : "D"}+{Math.abs(d.margin).toFixed(1)}
        </div>
      )}
    </div>
  );
};

export default function ElectionLab() {
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [tab, setTab] = useState("trend");

  useEffect(() => {
    console.log("ElectionLab: fetching /indiana_elections.json ...");
    fetch(import.meta.env.BASE_URL + "indiana_elections.json")
      .then(r => {
        console.log("ElectionLab: fetch response status", r.status);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(raw => {
        console.log("ElectionLab: raw JSON loaded,", raw.length, "entries");
        console.log("ElectionLab: first entry:", JSON.stringify(raw[0]).slice(0, 200));
        const processed = processCounties(raw);
        console.log("ElectionLab: processed", processed.length, "counties");
        if (processed.length > 0) {
          console.log("ElectionLab: first processed:", processed[0].county_name, processed[0].latestMargin);
        }
        setCounties(processed);
        setSelected(processed.find(c => c.county_name === "Marion")?.county_name || processed[0]?.county_name || null);
        setLoading(false);
      })
      .catch(err => {
        console.error("ElectionLab: LOAD ERROR:", err.message);
        setLoadError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let arr = counties.filter(c => c.county_name.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "name") arr.sort((a, b) => a.county_name.localeCompare(b.county_name));
    else if (sortBy === "margin") arr.sort((a, b) => a.latestMargin - b.latestMargin);
    else if (sortBy === "swing") arr.sort((a, b) => a.swing - b.swing);
    else if (sortBy === "shift") arr.sort((a, b) => a.totalShift - b.totalShift);
    return arr;
  }, [counties, search, sortBy]);

  const sel = selected ? counties.find(c => c.county_name === selected) : null;
  const comp = compare ? counties.find(c => c.county_name === compare) : null;
  const swingRanking = useMemo(() => [...counties].sort((a, b) => a.swing - b.swing), [counties]);
  const totalShiftRanking = useMemo(() => [...counties].sort((a, b) => a.totalShift - b.totalShift), [counties]);

  const statewide = useMemo(() => {
    if (counties.length === 0) return [];
    return YEARS.map(y => {
      let demT = 0, repT = 0;
      counties.forEach(c => {
        const row = c.data.find(d => d.year === y);
        if (row) { demT += row.dem_votes || 0; repT += row.rep_votes || 0; }
      });
      const total = demT + repT;
      if (total > 0) {
        return { year: y, dem_pct: +(demT / total * 100).toFixed(1), rep_pct: +(repT / total * 100).toFixed(1), margin: +((repT - demT) / total * 100).toFixed(1) };
      }
      const ms = counties.filter(c => c.data.find(d => d.year === y));
      const avg = ms.reduce((s, c) => s + (c.data.find(d => d.year === y)?.margin || 0), 0) / (ms.length || 1);
      return { year: y, dem_pct: +(50 - avg / 2).toFixed(1), rep_pct: +(50 + avg / 2).toFixed(1), margin: +avg.toFixed(1) };
    });
  }, [counties]);

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#999" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" />
          <div style={{ marginTop: 12, fontSize: "0.8rem" }}>Loading election data...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Failed to load election data</div>
        <div style={{ fontSize: "0.85rem", color: "#999" }}>{loadError}</div>
        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 12 }}>
          Check that <code>public/indiana_elections.json</code> exists and the dev server is running.
        </div>
      </div>
    );
  }

  if (counties.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#F59E0B" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>No county data found</div>
        <div style={{ fontSize: "0.85rem", color: "#999" }}>
          The JSON file loaded but no valid counties were parsed. Check the console (Cmd+Option+I) for details.
        </div>
      </div>
    );
  }

  // ── Styles ──
  const card = { background: "#111", borderRadius: 8, border: "1px solid #222", padding: 20 };
  const tabStyle = (k) => ({
    fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem", letterSpacing: "0.1em",
    textTransform: "uppercase", padding: "6px 14px", cursor: "pointer", border: "none",
    borderBottom: tab === k ? "2px solid var(--amber, #F59E0B)" : "2px solid transparent",
    background: tab === k ? "#1a1a1a" : "transparent",
    color: tab === k ? "#f0f0f0" : "#666", borderRadius: "4px 4px 0 0", transition: "all 180ms",
  });

  const StatCard = ({ label, value, color }) => (
    <div style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 14px", border: "1px solid #222", minWidth: 85, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );

  const formatMargin = (m) => `${m > 0 ? "R" : "D"}+${Math.abs(m).toFixed(1)}`;

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Sub-header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#f0f0f0" }}>
            Hoosier <span style={{ color: "var(--amber, #F59E0B)" }}>Election Lab</span>
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "#666" }}>
            County-Level Presidential Results · 2000–2024 · {counties.length} Counties
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #222" }}>
        {[["trend", "County Explorer"], ["swings", "Swing Analysis"], ["overview", "Statewide"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={tabStyle(k)}>{l}</button>
        ))}
      </div>

      {/* ═══════════ COUNTY EXPLORER ═══════════ */}
      {tab === "trend" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
          {/* Sidebar */}
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 10, borderBottom: "1px solid #222" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search counties..."
                style={{ width: "100%", background: "#0a0a0a", border: "1px solid #333", borderRadius: 4, padding: "6px 8px", color: "#e0e0e0", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                {[["name", "A→Z"], ["margin", "Margin"], ["swing", "Swing"], ["shift", "24yr"]].map(([k, l]) => (
                  <button key={k} onClick={() => setSortBy(k)} style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 3, border: "1px solid #333", cursor: "pointer",
                    background: sortBy === k ? "#333" : "transparent", color: sortBy === k ? "#f0f0f0" : "#666",
                    fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.05em"
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {filtered.map(c => {
                const cls = classify(c.latestMargin);
                const isSel = c.county_name === selected;
                const isComp = c.county_name === compare;
                return (
                  <div key={c.county_name}
                    onClick={() => setSelected(c.county_name)}
                    onContextMenu={e => { e.preventDefault(); setCompare(compare === c.county_name ? null : c.county_name); }}
                    style={{
                      padding: "8px 10px", cursor: "pointer",
                      borderLeft: isSel ? "3px solid var(--amber, #F59E0B)" : isComp ? "3px solid #A78BFA" : "3px solid transparent",
                      background: isSel ? "#1a1a1a" : "transparent", transition: "all 150ms",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: isSel ? 700 : 400, color: isSel ? "#f0f0f0" : "#ccc" }}>{c.county_name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: cls.color + "20", color: cls.color }}>{cls.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      <span style={{ color: mColor(c.latestMargin), fontWeight: 600 }}>{formatMargin(c.latestMargin)}</span>
                      <span style={{ margin: "0 5px" }}>·</span>
                      <span style={{ color: c.swing > 0 ? "#EF4444" : c.swing < 0 ? "#3B82F6" : "#666" }}>
                        Swing: {formatMargin(c.swing)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: 6, borderTop: "1px solid #222", fontSize: 9, color: "#444", textAlign: "center" }}>
              Right-click to compare
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {sel ? (
              <div style={card}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#f0f0f0" }}>
                      {sel.county_name} County
                      {comp && <span style={{ color: "#A78BFA", fontSize: "0.85rem" }}> vs {comp.county_name}</span>}
                    </h3>
                    <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0" }}>FIPS: {sel.FIPS}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <StatCard label="Current" value={formatMargin(sel.latestMargin)} color={mColor(sel.latestMargin)} />
                    <StatCard label="Swing" value={formatMargin(sel.swing)} color={sel.swing > 0 ? "#EF4444" : "#3B82F6"} />
                    <StatCard label="24yr Shift" value={formatMargin(sel.totalShift)} color={sel.totalShift > 0 ? "#EF4444" : "#3B82F6"} />
                  </div>
                </div>

                {/* Margin chart */}
                <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Partisan Margin Over Time
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={sel.data} margin={{ top: 5, right: 15, bottom: 5, left: 15 }}>
                    <defs>
                      <linearGradient id="gUp" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={0} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: "#222" }} tick={{ fill: "#555", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#555", fontSize: 10 }}
                      tickFormatter={v => `${v > 0 ? "R" : "D"}+${Math.abs(v)}`} />
                    <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />
                    <Tooltip content={<TT />} />
                    <Area type="monotone" dataKey="margin" stroke="#F59E0B" strokeWidth={2.5}
                      fill="url(#gUp)" dot={{ fill: "#F59E0B", r: 4, strokeWidth: 0 }} />
                    {comp && (
                      <Area type="monotone" data={comp.data} dataKey="margin" stroke="#A78BFA"
                        strokeWidth={2} strokeDasharray="6 3" fill="none" dot={{ fill: "#A78BFA", r: 3 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ textAlign: "center", fontSize: 10, color: "#444", marginTop: 2 }}>
                  Above zero = R advantage · Below zero = D advantage
                </div>

                {/* Two-party share chart */}
                <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>
                  Two-Party Vote Share
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={sel.data} margin={{ top: 5, right: 15, bottom: 5, left: 15 }}>
                    <defs>
                      <linearGradient id="demG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="repG" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: "#222" }} tick={{ fill: "#555", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#555", fontSize: 10 }}
                      tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <ReferenceLine y={50} stroke="#444" strokeDasharray="4 4" />
                    <Tooltip content={<TT />} />
                    <Area type="monotone" dataKey="dem_pct" stroke="#3B82F6" strokeWidth={2} fill="url(#demG)" dot={{ fill: "#3B82F6", r: 3 }} />
                    <Area type="monotone" dataKey="rep_pct" stroke="#EF4444" strokeWidth={2} fill="url(#repG)" dot={{ fill: "#EF4444", r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Election table */}
                <div style={{ marginTop: 16, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #222" }}>
                        {["Year", "Dem %", "Rep %", "Margin", "Shift"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: h === "Year" ? "left" : "right", color: "#555", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sel.data.map((d, i) => {
                        const prev = i > 0 ? sel.data[i - 1].margin : null;
                        const shift = prev !== null ? +(d.margin - prev).toFixed(1) : null;
                        return (
                          <tr key={d.year} style={{ borderBottom: "1px solid #1a1a1a" }}>
                            <td style={{ padding: "5px 8px", fontWeight: 700 }}>{d.year}</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: "#3B82F6" }}>{Number(d.dem_pct).toFixed(1)}%</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: "#EF4444" }}>{Number(d.rep_pct).toFixed(1)}%</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: mColor(d.margin) }}>{formatMargin(d.margin)}</td>
                            <td style={{ padding: "5px 8px", textAlign: "right", color: shift === null ? "#444" : shift > 0 ? "#EF4444" : "#3B82F6" }}>
                              {shift === null ? "—" : formatMargin(shift)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ ...card, textAlign: "center", color: "#666", padding: 60 }}>
                Select a county from the list
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ SWING ANALYSIS ═══════════ */}
      {tab === "swings" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <h3 style={{ fontSize: 14, margin: "0 0 2px", color: "#f0f0f0" }}>Biggest Swings: Last Cycle</h3>
            <p style={{ color: "#555", fontSize: 11, margin: "0 0 12px" }}>Margin shift 2020 → 2024</p>
            <ResponsiveContainer width="100%" height={Math.max(300, Math.min(swingRanking.length, 20) * 26)}>
              <BarChart data={swingRanking.slice(0, 20)} layout="vertical" margin={{ top: 0, right: 15, bottom: 0, left: 80 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#555", fontSize: 10 }}
                  tickFormatter={v => `${v > 0 ? "R" : "D"}+${Math.abs(v)}`} />
                <YAxis type="category" dataKey="county_name" tickLine={false} axisLine={false}
                  tick={{ fill: "#999", fontSize: 11 }} width={75} />
                <ReferenceLine x={0} stroke="#444" />
                <Tooltip formatter={v => [`${v > 0 ? "R" : "D"}+${Math.abs(v).toFixed(1)}`, "Swing"]}
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="swing" radius={[3, 3, 3, 3]}>
                  {swingRanking.slice(0, 20).map((c, i) => (
                    <Cell key={i} fill={c.swing > 0 ? "#EF4444" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 14, margin: "0 0 2px", color: "#f0f0f0" }}>Total Shift: 2000 → 2024</h3>
            <p style={{ color: "#555", fontSize: 11, margin: "0 0 12px" }}>Cumulative margin change</p>
            <ResponsiveContainer width="100%" height={Math.max(300, Math.min(totalShiftRanking.length, 20) * 26)}>
              <BarChart data={totalShiftRanking.slice(0, 20)} layout="vertical" margin={{ top: 0, right: 15, bottom: 0, left: 80 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#555", fontSize: 10 }}
                  tickFormatter={v => `${v > 0 ? "R" : "D"}+${Math.abs(v)}`} />
                <YAxis type="category" dataKey="county_name" tickLine={false} axisLine={false}
                  tick={{ fill: "#999", fontSize: 11 }} width={75} />
                <ReferenceLine x={0} stroke="#444" />
                <Tooltip formatter={v => [`${v > 0 ? "R" : "D"}+${Math.abs(v).toFixed(1)}`, "Shift"]}
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="totalShift" radius={[3, 3, 3, 3]}>
                  {totalShiftRanking.slice(0, 20).map((c, i) => (
                    <Cell key={i} fill={c.totalShift > 0 ? "#EF4444" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Classification */}
          <div style={{ ...card, gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 14, margin: "0 0 14px", color: "#f0f0f0" }}>
              County Classification: {counties[0]?.latestYear || 2024}
            </h3>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {["Safe D", "Lean D", "Toss-Up", "Lean R", "Safe R"].map(cls => {
                const group = counties.filter(c => c.classification === cls).sort((a, b) => a.latestMargin - b.latestMargin);
                const clr = classify(cls === "Safe D" ? -20 : cls === "Lean D" ? -10 : cls === "Toss-Up" ? 0 : cls === "Lean R" ? 10 : 20).color;
                return (
                  <div key={cls} style={{ flex: "1 1 160px", minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: clr }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#e0e0e0" }}>{cls}</span>
                      <span style={{ fontSize: 11, color: "#555" }}>({group.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {group.map(c => (
                        <div key={c.county_name}
                          onClick={() => { setSelected(c.county_name); setTab("trend"); }}
                          style={{
                            fontSize: 11, padding: "3px 6px", background: "#0a0a0a", borderRadius: 3,
                            cursor: "pointer", display: "flex", justifyContent: "space-between", border: "1px solid #1a1a1a"
                          }}>
                          <span style={{ color: "#ccc" }}>{c.county_name}</span>
                          <span style={{ color: clr, fontWeight: 600 }}>{formatMargin(c.latestMargin)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STATEWIDE ═══════════ */}
      {tab === "overview" && (
        <div>
          <div style={card}>
            <h3 style={{ fontSize: 16, margin: "0 0 2px", color: "#f0f0f0" }}>Indiana Statewide Trend</h3>
            <p style={{ color: "#555", fontSize: 11, margin: "0 0 16px" }}>Aggregated from county-level vote totals</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={statewide} margin={{ top: 5, right: 15, bottom: 5, left: 15 }}>
                <defs>
                  <linearGradient id="demSW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repSW" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: "#222" }} tick={{ fill: "#555", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#555", fontSize: 10 }}
                  tickFormatter={v => `${v}%`} domain={[20, 80]} />
                <ReferenceLine y={50} stroke="#444" strokeDasharray="4 4" />
                <Tooltip content={<TT />} />
                <Area type="monotone" dataKey="dem_pct" stroke="#3B82F6" strokeWidth={2.5} fill="url(#demSW)" dot={{ fill: "#3B82F6", r: 4 }} />
                <Area type="monotone" dataKey="rep_pct" stroke="#EF4444" strokeWidth={2.5} fill="url(#repSW)" dot={{ fill: "#EF4444", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 11 }}>
              <span style={{ color: "#3B82F6" }}>● Democratic</span>
              <span style={{ color: "#EF4444" }}>● Republican</span>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
            {[
              { label: "Counties", value: counties.length, color: "var(--amber, #F59E0B)" },
              { label: "Safe R", value: counties.filter(c => c.classification === "Safe R").length, color: "#EF4444" },
              { label: "Lean R", value: counties.filter(c => c.classification === "Lean R").length, color: "#FCA5A5" },
              { label: "Toss-Up", value: counties.filter(c => c.classification === "Toss-Up").length, color: "#A78BFA" },
              { label: "Lean D", value: counties.filter(c => c.classification === "Lean D").length, color: "#93C5FD" },
              { label: "Safe D", value: counties.filter(c => c.classification === "Safe D").length, color: "#3B82F6" },
            ].map(s => (
              <div key={s.label} style={{ ...card, textAlign: "center", padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Statewide table */}
          <div style={{ ...card, marginTop: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #222" }}>
                  {["Year", "Dem %", "Rep %", "Margin", "Shift"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Year" ? "left" : "right", color: "#555", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statewide.map((d, i) => {
                  const prev = i > 0 ? statewide[i - 1].margin : null;
                  const shift = prev !== null ? +(d.margin - prev).toFixed(1) : null;
                  return (
                    <tr key={d.year} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700, fontSize: 14 }}>{d.year}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#3B82F6", fontWeight: 600 }}>{d.dem_pct}%</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#EF4444", fontWeight: 600 }}>{d.rep_pct}%</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, fontSize: 14, color: mColor(d.margin) }}>{formatMargin(d.margin)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: shift === null ? "#444" : shift > 0 ? "#EF4444" : "#3B82F6", fontWeight: 600 }}>
                        {shift === null ? "—" : `${shift > 0 ? "→ R" : "→ D"} ${Math.abs(shift).toFixed(1)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #1a1a1a", fontSize: 10, color: "#444", textAlign: "center", lineHeight: 1.5 }}>
        Two-party vote share (D + R = 100%). · Source: Harvard Dataverse (MEDSL) 2000–2016; tonmcg/GitHub 2020–2024.
      </div>
    </div>
  );
}
