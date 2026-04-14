import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { compareAntibodies, getCompareExportUrl } from "../utils/api";
import ExportButton from "../components/ExportButton";

const SCORE_LABELS = [
  { key: "citation_score", label: "Citations" },
  { key: "application_breadth", label: "App Breadth" },
  { key: "recency_score", label: "Recency" },
];

const COLORS = ["#0066f5", "#e5430a", "#16a34a", "#8b5cf6", "#d97706"];

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  useEffect(() => {
    async function load() {
      if (ids.length < 2) {
        setError("Select at least 2 antibodies to compare.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await compareAntibodies(ids);
        setComparisons(data.comparisons);
      } catch (err) {
        setError("Failed to load comparison data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    }, [searchParams.toString()]);


  if (loading) return <div className="loading">Loading comparison...</div>;
  if (error) return <div className="error">{error}</div>;

  // Collect all unique applications across all antibodies
  const allApps = [
    ...new Set(comparisons.flatMap((c) => c.applications.map((a) => a.application))),
  ].sort();

  return (
    <div className="compare-page">
      <div className="compare-header">
        <h1>Antibody Comparison</h1>
        <ExportButton href={getCompareExportUrl(ids)} label="Export Comparison" />
      </div>

      {/* Overview cards */}
      <div className="compare-cards">
        {comparisons.map((c, idx) => {
          const ab = c.antibody;
          return (
            <div
              key={ab.id}
              className="compare-card"
              style={{ borderTopColor: COLORS[idx % COLORS.length] }}
            >
              <div className="compare-card-color" style={{ background: COLORS[idx % COLORS.length] }} />
              <Link to={`/antibody/${ab.id}`} className="compare-card-title">
                {ab.vendor}
              </Link>
              <div className="compare-card-subtitle">
                {ab.clone_name || ab.catalog_number}
              </div>
              <div className="compare-card-meta">
                <span>{ab.gene_name}</span>
                <span>{ab.host_species}</span>
                <span>{ab.clonality}</span>
              </div>
              <div className="compare-card-score">
                <span className="big-score">
                  {ab.overall_score ? Number(ab.overall_score).toFixed(1) : "—"}
                </span>
                <span className="score-label">/ 10</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score comparison bars */}
      <section className="compare-section">
        <h2>Score Breakdown</h2>
        <div className="compare-score-grid">
          {SCORE_LABELS.map(({ key, label }) => (
            <div key={key} className="compare-score-row">
              <div className="compare-score-label">{label}</div>
              <div className="compare-bars">
                {comparisons.map((c, idx) => {
                  const val = Number(c.antibody[key] || 0);
                  return (
                    <div key={c.antibody.id} className="compare-bar-row">
                      <div
                        className="compare-bar"
                        style={{
                          width: `${val * 10}%`,
                          background: COLORS[idx % COLORS.length],
                        }}
                      />
                      <span className="compare-bar-val">{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Positive rate — on a 0-100 scale */}
          <div className="compare-score-row">
            <div className="compare-score-label">Positive Rate</div>
            <div className="compare-bars">
              {comparisons.map((c, idx) => {
                const val = Number(c.antibody.positive_rate || 0);
                return (
                  <div key={c.antibody.id} className="compare-bar-row">
                    <div
                      className="compare-bar"
                      style={{
                        width: `${val}%`,
                        background: COLORS[idx % COLORS.length],
                      }}
                    />
                    <span className="compare-bar-val">{val.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Application coverage matrix */}
      <section className="compare-section">
        <h2>Application Coverage</h2>
        <table className="compare-matrix">
          <thead>
            <tr>
              <th>Application</th>
              {comparisons.map((c, idx) => (
                <th key={c.antibody.id} style={{ color: COLORS[idx % COLORS.length] }}>
                  {c.antibody.vendor} {c.antibody.clone_name || c.antibody.catalog_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allApps.map((app) => (
              <tr key={app}>
                <td><strong>{app}</strong></td>
                {comparisons.map((c) => {
                  const appData = c.applications.find((a) => a.application === app);
                  return (
                    <td key={c.antibody.id}>
                      {appData ? (
                        <span className="app-cell">
                          {appData.count} val · {Number(appData.success_rate).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="app-cell-empty">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Quick stats */}
      <section className="compare-section">
        <h2>Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {comparisons.map((c, idx) => (
                <th key={c.antibody.id} style={{ color: COLORS[idx % COLORS.length] }}>
                  {c.antibody.clone_name || c.antibody.catalog_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Validations</td>
              {comparisons.map((c) => (
                <td key={c.antibody.id}>{c.antibody.total_validations || 0}</td>
              ))}
            </tr>
            <tr>
              <td>Applications Tested</td>
              {comparisons.map((c) => (
                <td key={c.antibody.id}>{c.applications.length}</td>
              ))}
            </tr>
            <tr>
              <td>RRID</td>
              {comparisons.map((c) => (
                <td key={c.antibody.id}>
                  <code>{c.antibody.ab_registry_id}</code>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}