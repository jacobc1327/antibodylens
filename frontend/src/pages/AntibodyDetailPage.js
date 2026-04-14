import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAntibodyDetail } from "../utils/api";
import BookmarkButton from "../components/BookmarkButton.js";

function fmt1(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(1) : null;
}

function fmt0(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(0) : null;
}

export default function AntibodyDetailPage() {
  const { id } = useParams();
  const [antibody, setAntibody] = useState(null);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h2>
          Confidence Score: {fmt1(antibody.overall_score) ?? "—"} / 10
        </h2>
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