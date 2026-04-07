import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchTargets } from "../utils/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // TODO: Add debounce (300ms) so you're not firing on every keystroke
  const handleSearch = useCallback(async (q) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchTargets(q);
      setResults(data.targets);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="search-page">
      <div className="search-hero">
        <h1>Find validated antibodies for any protein target</h1>
        <p>
          Search by gene name (e.g., <strong>TP53</strong>, <strong>EGFR</strong>,{" "}
          <strong>HER2</strong>) to explore antibody validation data across
          applications, species, and publications.
        </p>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search protein targets..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {loading && <span className="search-spinner">⏳</span>}
        </div>

        {results.length > 0 && (
          <ul className="search-results">
            {results.map((t) => (
              <li key={t.id} onClick={() => navigate(`/target/${t.id}`)}>
                <strong>{t.gene_name}</strong>
                <span className="protein-name">{t.protein_name}</span>
                <span className="uniprot-id">{t.uniprot_id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* TODO: Add "Popular Targets" grid showing top 15 seeded targets
           as clickable cards with antibody counts */}
    </div>
  );
}
