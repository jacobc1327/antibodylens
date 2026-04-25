import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAntibodyDetail } from "../utils/api";
import BookmarkButton from "../components/BookmarkButton.js";

function fmt1(x) {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(1) : null;
}

function fmt0(x) {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(0) : null;
}

export default function AntibodyDetailPage() {
  const { id } = useParams();
  const [antibody, setAntibody] = useState(null);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await getAntibodyDetail(id);
        setAntibody(data.antibody);
        setValidations(data.validations);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!antibody) return <div className="error">Antibody not found</div>;

  const totalCitations = validations.reduce((s, v) => s + (Number(v.citation_count) || 0), 0);
  const distinctApps = new Set(validations.map((v) => v.application).filter(Boolean)).size;
  const latestYear = validations.reduce((m, v) => Math.max(m, Number(v.pub_year) || 0), 0) || null;
  const positiveCount = validations.reduce((s, v) => s + (v.validated_positive ? 1 : 0), 0);
  const positiveRate = validations.length ? (positiveCount / validations.length) * 100 : null;

  return (
    <div className="antibody-detail-page">
      <Link to={`/target/${antibody.target_id}`} className="back-link">
        ← Back to {antibody.gene_name}
      </Link>

      <section className="antibody-header">
        <div className="antibody-header-row">
          <h1>
            {antibody.vendor} — {antibody.clone_name || antibody.catalog_number}
          </h1>
          <BookmarkButton antibody={antibody} size="lg" />
        </div>
        <div className="meta-grid">
          <div>
            <strong>Target:</strong> {antibody.gene_name} ({antibody.protein_name})
          </div>
          <div>
            <strong>Host:</strong> {antibody.host_species}
          </div>
          <div>
            <strong>Clonality:</strong> {antibody.clonality}
          </div>
          <div>
            <strong>Isotype:</strong> {antibody.isotype}
          </div>
          <div>
            <strong>RRID:</strong> {antibody.ab_registry_id}
          </div>
        </div>
      </section>

      {/* Confidence score breakdown */}
      <section className="score-breakdown">
        <div className="score-breakdown-head">
          <h2>
            Confidence Score: {fmt1(antibody.overall_score) ?? "—"} / 10
          </h2>
          <button
            type="button"
            className="score-how-btn"
            onClick={() => setShowHow((v) => !v)}
            aria-expanded={showHow}
          >
            {showHow ? "Hide" : "How is this computed?"}
          </button>
        </div>

        {showHow && (
          <div className="score-how">
            <div className="score-how-grid">
              <div className="score-how-card">
                <div className="score-how-title">Inputs (this antibody)</div>
                <div className="score-how-row"><span>Total validations</span><strong>{validations.length}</strong></div>
                <div className="score-how-row"><span>Distinct assays</span><strong>{distinctApps}</strong></div>
                <div className="score-how-row"><span>Total citations</span><strong>{totalCitations}</strong></div>
                <div className="score-how-row"><span>Latest year</span><strong>{latestYear ?? "—"}</strong></div>
                <div className="score-how-row"><span>Positive rate</span><strong>{positiveRate === null ? "—" : `${positiveRate.toFixed(0)}%`}</strong></div>
              </div>

              <div className="score-how-card">
                <div className="score-how-title">Score components (0–10)</div>
                <div className="score-how-row"><span>Citations score</span><strong>{fmt1(antibody.citation_score) ?? "—"}</strong></div>
                <div className="score-how-row"><span>Application breadth</span><strong>{fmt1(antibody.application_breadth) ?? "—"}</strong></div>
                <div className="score-how-row"><span>Recency score</span><strong>{fmt1(antibody.recency_score) ?? "—"}</strong></div>
                <div className="score-how-row"><span>Positive rate</span><strong>{fmt0(antibody.positive_rate) ? `${fmt0(antibody.positive_rate)}%` : "—"}</strong></div>
              </div>
            </div>

            <div className="score-how-foot">
              The overall score is a weighted combination of citations, assay breadth, recency, and positive rate.
              (In this demo, validations are synthetic; the calculation is deterministic given the inputs.)
            </div>
          </div>
        )}

        <div className="score-bars">
          <div className="score-item">
            <label>Citations</label>
            <div
              className="bar"
              style={{ width: `${(antibody.citation_score || 0) * 10}%` }}
            />
            <span>{fmt1(antibody.citation_score) ?? "—"}</span>
          </div>
          <div className="score-item">
            <label>Application Breadth</label>
            <div
              className="bar"
              style={{
                width: `${(antibody.application_breadth || 0) * 10}%`,
              }}
            />
            <span>{fmt1(antibody.application_breadth) ?? "—"}</span>
          </div>
          <div className="score-item">
            <label>Recency</label>
            <div
              className="bar"
              style={{ width: `${(antibody.recency_score || 0) * 10}%` }}
            />
            <span>{fmt1(antibody.recency_score) ?? "—"}</span>
          </div>
          <div className="score-item">
            <label>Positive Rate</label>
            <div
              className="bar"
              style={{ width: `${antibody.positive_rate || 0}%` }}
            />
            <span>{(fmt0(antibody.positive_rate) ?? "—")}{fmt0(antibody.positive_rate) ? "%" : ""}</span>
          </div>
        </div>
      </section>

      {/* Validations table */}
      <section className="validations-section">
        <h2>Validations ({validations.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Species</th>
              <th>Journal</th>
              <th>Year</th>
              <th>Citations</th>
              <th>Result</th>
              <th>PubMed</th>
            </tr>
          </thead>
          <tbody>
            {validations.map((v, i) => (
              <tr key={i}>
                <td>{v.application}</td>
                <td>{v.species_tested}</td>
                <td>{v.journal}</td>
                <td>{v.pub_year}</td>
                <td>{v.citation_count}</td>
                <td className={v.validated_positive ? "positive" : "negative"}>
                  {v.validated_positive ? "✓ Positive" : "✗ Negative"}
                </td>
                <td>
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${v.pubmed_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {v.pubmed_id}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}