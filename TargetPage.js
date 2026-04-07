import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTarget, getAntibodies, getTargetStats } from "../utils/api";
import ValidationHeatmap from "../components/ValidationHeatmap";
import ApplicationBarChart from "../components/ApplicationBarChart";
import PublicationTimeline from "../components/PublicationTimeline";

export default function TargetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [target, setTarget] = useState(null);
  const [antibodies, setAntibodies] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    application: "",
    species: "",
    host: "",
    sort: "score",
    page: 1,
  });
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [targetRes, statsRes] = await Promise.all([
          getTarget(id),
          getTargetStats(id),
        ]);
        setTarget(targetRes.data.target);
        setStats(statsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    async function loadAntibodies() {
      try {
        const { data } = await getAntibodies(id, filters);
        setAntibodies(data.antibodies);
        setPagination({ total: data.total, pages: data.pages, page: data.page });
      } catch (err) {
        console.error(err);
      }
    }
    loadAntibodies();
  }, [id, filters]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!target) return <div className="error">Target not found</div>;

  return (
    <div className="target-page">
      {/* Target header */}
      <section className="target-header">
        <h1>{target.gene_name}</h1>
        <p className="protein-name">{target.protein_name}</p>
        <p className="meta">
          UniProt: <a href={`https://www.uniprot.org/uniprotkb/${target.uniprot_id}`}
                      target="_blank" rel="noreferrer">{target.uniprot_id}</a>
          {" · "}{target.antibody_count} antibodies catalogued
        </p>
        {target.function_summary && (
          <p className="function-summary">{target.function_summary}</p>
        )}
      </section>

      {/* D3 Visualizations */}
      <section className="visualizations">
        <div className="viz-grid">
          {stats && (
            <>
              <ApplicationBarChart data={stats.by_application} />
              <PublicationTimeline data={stats.by_year} />
            </>
          )}
        </div>
        {/* TODO: Add ValidationHeatmap component here */}
      </section>

      {/* Filters */}
      <section className="filters">
        <select value={filters.application}
                onChange={(e) => setFilters({ ...filters, application: e.target.value, page: 1 })}>
          <option value="">All Applications</option>
          <option value="WB">Western Blot</option>
          <option value="IHC">IHC</option>
          <option value="IF">Immunofluorescence</option>
          <option value="FC">Flow Cytometry</option>
          <option value="ChIP">ChIP</option>
          <option value="ELISA">ELISA</option>
          <option value="IP">IP</option>
        </select>

        <select value={filters.species}
                onChange={(e) => setFilters({ ...filters, species: e.target.value, page: 1 })}>
          <option value="">All Species</option>
          <option value="Human">Human</option>
          <option value="Mouse">Mouse</option>
          <option value="Rat">Rat</option>
        </select>

        <select value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}>
          <option value="score">Confidence Score</option>
          <option value="citations">Citations</option>
          <option value="recent">Most Recent</option>
          <option value="validations">Most Validations</option>
        </select>
      </section>

      {/* Antibody table */}
      <section className="antibody-table">
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Clone / Catalog</th>
              <th>Host</th>
              <th>Clonality</th>
              <th>Score</th>
              <th>Validations</th>
              <th>Positive Rate</th>
            </tr>
          </thead>
          <tbody>
            {antibodies.map((ab) => (
              <tr key={ab.id} onClick={() => navigate(`/antibody/${ab.id}`)}
                  className="clickable-row">
                <td>{ab.vendor}</td>
                <td>{ab.clone_name || ab.catalog_number}</td>
                <td>{ab.host_species}</td>
                <td>{ab.clonality}</td>
                <td>
                  <span className={`score score-${Math.floor(ab.overall_score || 0)}`}>
                    {ab.overall_score?.toFixed(1) || "—"}
                  </span>
                </td>
                <td>{ab.total_validations || 0}</td>
                <td>{ab.positive_rate ? `${ab.positive_rate.toFixed(0)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button disabled={filters.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
              ← Prev
            </button>
            <span>Page {pagination.page} of {pagination.pages}</span>
            <button disabled={filters.page >= pagination.pages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
