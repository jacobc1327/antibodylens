import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { autocompleteTargets } from "../utils/api";
import CellVisualization from "../components/CellVisualization";

function useDebounce(fn, delay) {
  const timer = useRef(null);
  const debounced = useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return debounced;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [targetResults, setTargetResults] = useState([]);
  const [antibodyResults, setAntibodyResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (q.length < 1) {
      setTargetResults([]);
      setAntibodyResults([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await autocompleteTargets(q);
      setTargetResults(data.targets || []);
      setAntibodyResults(data.antibodies || []);
      setShowDropdown(true);
      setActiveIndex(-1);
    } catch (err) {
      console.error("Autocomplete failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(doSearch, 250);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const allItems = [
    ...targetResults.map((t) => ({ type: "target", data: t })),
    ...antibodyResults.map((a) => ({ type: "antibody", data: a })),
  ];

  const handleKeyDown = (e) => {
    if (!showDropdown || allItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = allItems[activeIndex];
      if (item.type === "target") navigate(`/target/${item.data.id}`);
      else navigate(`/antibody/${item.data.id}`);
      setShowDropdown(false);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="search-page-cell">
      {/* Hero text + search */}
      <div className="cell-search-hero">
        <h1>Navigate antibody validation<br />inside the cell</h1>
        <p>
          Click any protein below to explore its antibodies, or search by gene name,
          vendor, or catalog number.
        </p>

        <div className="search-box" ref={dropdownRef}>
          <input
            type="text"
            placeholder="Search targets, antibodies, vendors..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() =>
              query.length >= 1 && allItems.length > 0 && setShowDropdown(true)
            }
            autoFocus
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
          />
          {loading && <span className="search-spinner">\u23F3</span>}

          {showDropdown && allItems.length > 0 && (
            <div className="autocomplete-dropdown" role="listbox">
              {targetResults.length > 0 && (
                <div className="autocomplete-group">
                  <div className="autocomplete-group-label">Protein Targets</div>
                  {targetResults.map((t, i) => (
                    <div
                      key={`t-${t.id}`}
                      className={`autocomplete-item ${activeIndex === i ? "active" : ""}`}
                      onClick={() => { navigate(`/target/${t.id}`); setShowDropdown(false); }}
                      role="option"
                      aria-selected={activeIndex === i}
                    >
                      <span className="ac-icon">\uD83E\uDDEC</span>
                      <span className="ac-primary">{t.gene_name}</span>
                      <span className="ac-secondary">{t.protein_name}</span>
                      <span className="ac-badge">{t.uniprot_id}</span>
                    </div>
                  ))}
                </div>
              )}
              {antibodyResults.length > 0 && (
                <div className="autocomplete-group">
                  <div className="autocomplete-group-label">Antibodies</div>
                  {antibodyResults.map((a, j) => {
                    const globalIdx = targetResults.length + j;
                    return (
                      <div
                        key={`a-${a.id}`}
                        className={`autocomplete-item ${activeIndex === globalIdx ? "active" : ""}`}
                        onClick={() => { navigate(`/antibody/${a.id}`); setShowDropdown(false); }}
                        role="option"
                        aria-selected={activeIndex === globalIdx}
                      >
                        <span className="ac-icon">\uD83D\uDD2C</span>
                        <span className="ac-primary">{a.vendor} \u2014 {a.clone_name || a.catalog_number}</span>
                        <span className="ac-secondary">{a.gene_name}</span>
                        {a.overall_score && (
                          <span className="ac-score">{Number(a.overall_score).toFixed(1)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showDropdown && query.length >= 1 && allItems.length === 0 && !loading && (
            <div className="autocomplete-dropdown">
              <div className="autocomplete-empty">No results for "{query}"</div>
            </div>
          )}
        </div>
      </div>

      {/* Living Cell — the centerpiece */}
      <CellVisualization />

      {/* Contextual footer */}
      <div className="cell-explainer">
        <p>
          Each glowing point represents a protein target at its real subcellular location.
          Size reflects validation evidence. Filter by application to see coverage gaps.
        </p>
      </div>
    </div>
  );
}